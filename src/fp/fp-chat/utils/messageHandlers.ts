/**
 * Message event handlers for Agora Chat SDK
 * Handles incoming text messages, custom messages, and connection events
 */

import config from "../../common/config.ts";
import type { Contact, LogEntry } from "../../common/types/chat";
import type { MessageBody } from "agora-chat";
import React from "react";
import { isBlockedUID } from "./blockedUIDs";
import { shouldSuppressMultiDeviceSessionChatPayload } from "./chatPayloadFilters.ts";

/** Agora `Code`: logged in on another device — do not auto-reconnect or tabs fight in a loop. */
const AGORA_LOGIN_ANOTHER_DEVICE = 206;
/** Agora `Code`: kicked by another device */
const AGORA_KICKED_BY_OTHER_DEVICE = 217;

function isAgoraSessionConflictError(
  error: { type?: unknown } | null | undefined
): boolean {
  const t = error?.type;
  return (
    t === AGORA_LOGIN_ANOTHER_DEVICE || t === AGORA_KICKED_BY_OTHER_DEVICE
  );
}

interface IncomingCall {
  from: string;
  channel: string;
  callId?: string;
  callType?: "video" | "audio";
}

interface MessageHandlersOptions {
  userId: string;
  setIsLoggedIn: (value: boolean) => void;
  setIsLoggingIn: (value: boolean) => void;
  addLog: (log: string | LogEntry) => void;
  setConversations: React.Dispatch<React.SetStateAction<Contact[]>>;
  generateNewToken: () => Promise<string | null>;
  handleIncomingCall: (callData: IncomingCall) => void;
  onPresenceStatus?: (presenceData: {
    userId: string;
    description: string;
  }) => void;
  clientRef:
    | React.RefObject<unknown>
    | (() => unknown)
    | { current?: unknown };
  onSessionConflictFromOtherClient?: () => void;
}

export function formatScheduledDate(date: Date): string {
  const day = date.getDate();
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const month = monthNames[date.getMonth()];
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
  return `${day} ${month} ${hours}:${minutesStr} ${ampm}`;
}

/**
 * Creates message event handlers for the chat client
 */
export function createMessageHandlers({
  userId,
  setIsLoggedIn,
  setIsLoggingIn,
  addLog,
  setConversations,
  generateNewToken,
  handleIncomingCall,
  onPresenceStatus,
  clientRef,
  onSessionConflictFromOtherClient,
}: MessageHandlersOptions): {
  onConnected: () => void;
  onDisconnected: (error?: { type?: unknown }) => void;
  onTextMessage: (msg: MessageBody) => void;
  onCustomMessage: (msg: MessageBody) => void;
  onModifiedMessage: (msg: MessageBody) => void;
  onTokenWillExpire: () => Promise<void>;
  onTokenExpired: () => Promise<void>;
  onError: (e: {
    message: string;
    code?: string;
    type?: number | string;
  }) => void;
  onPresenceStatus?: (presenceData: {
    userId: string;
    description: string;
  }) => void;
} {
  const getClientRef = (): unknown => {
    if (typeof clientRef === "function") return clientRef();
    if (clientRef && typeof clientRef === "object" && "current" in clientRef) {
      return (clientRef as { current?: unknown }).current;
    }
    return clientRef;
  };

  // ---------------------------------------------------------------------------
  // Shared helpers
  // ---------------------------------------------------------------------------

  const isNonEmptyObject = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && Object.keys(v as object).length > 0;

  /** Try to JSON.parse a string; return null on failure. */
  function tryParseJSON(str: string): Record<string, unknown> | null {
    try {
      const r = JSON.parse(str);
      return r && typeof r === "object" ? r : null;
    } catch {
      return null;
    }
  }

  /**
   * Extract the structured payload from an Agora custom message.
   * Tries every known location the SDK / backend may place the data.
   */
  function extractCustomPayload(
    msg: MessageBody
  ): Record<string, unknown> | null {
    // 1. body with API format { messageType, payload }
    if (msg.body && typeof msg.body === "object") {
      const b = msg.body as { messageType?: string; payload?: unknown };
      if (b.messageType && b.payload) {
        return {
          ...(b.payload as object),
          type: b.messageType,
        } as Record<string, unknown>;
      }
    }

    // 2. customExts (standard Agora format)
    if (isNonEmptyObject(msg.customExts)) return msg.customExts as Record<string, unknown>;

    // 3. v2:customExts
    if (isNonEmptyObject(msg["v2:customExts"])) return msg["v2:customExts"] as Record<string, unknown>;

    // 4. body.customExts / body["v2:customExts"]
    if (msg.body && typeof msg.body === "object") {
      const b = msg.body as {
        customExts?: unknown;
        "v2:customExts"?: unknown;
      };
      if (isNonEmptyObject(b.customExts)) return b.customExts as Record<string, unknown>;
      if (isNonEmptyObject(b["v2:customExts"])) return b["v2:customExts"] as Record<string, unknown>;
    }

    // 5. bodies array
    if (Array.isArray(msg.bodies)) {
      for (const item of msg.bodies) {
        if (item?.["v2:customExts"]) return item["v2:customExts"] as Record<string, unknown>;
        if (item?.customExts?.[0]?.url) return { ...item.customExts[0] } as Record<string, unknown>;
      }
    }

    // 6. params
    if (msg.params != null) {
      if (typeof msg.params === "string") {
        const parsed = tryParseJSON(msg.params);
        if (parsed) return parsed;
      } else if (typeof msg.params === "object") {
        return msg.params as Record<string, unknown>;
      }
    }

    // 7. ext (attachment properties spread directly, or ext.data)
    if (msg.ext && typeof msg.ext === "object") {
      const extType = msg.ext.type as string | undefined;
      if (extType && ["image", "file", "audio"].includes(extType)) {
        return {
          type: extType,
          url: msg.ext.url,
          fileName: msg.ext.fileName,
          mimeType: msg.ext.mimeType,
          size: msg.ext.size,
          duration: msg.ext.duration,
          transcription: msg.ext.transcription,
        };
      }
      if (msg.ext.data) {
        const parsed =
          typeof msg.ext.data === "string"
            ? tryParseJSON(msg.ext.data)
            : (msg.ext.data as Record<string, unknown>);
        if (isNonEmptyObject(parsed)) return parsed;
      }
      const copy = { ...msg.ext };
      if (typeof copy.data === "string") delete copy.data;
      if (Object.keys(copy).length > 0) return copy as Record<string, unknown>;
    }

    // 8. body as raw JSON string
    if (msg.body) {
      const b =
        typeof msg.body === "string"
          ? tryParseJSON(msg.body)
          : (msg.body as Record<string, unknown>);
      if (b) {
        if (b.messageType && b.payload) {
          return { ...(b.payload as object), type: b.messageType } as Record<string, unknown>;
        }
        if (isNonEmptyObject(b)) return b;
      }
    }

    // 9. msg.msg as JSON (last resort)
    if (msg.msg) {
      const m =
        typeof msg.msg === "string"
          ? tryParseJSON(msg.msg as string)
          : (msg.msg as unknown as Record<string, unknown>);
      if (m) {
        if (m.messageType && m.payload) {
          return { ...(m.payload as object), type: m.messageType } as Record<string, unknown>;
        }
        if (isNonEmptyObject(m)) return m;
      }
    }

    return null;
  }

  /** Normalize a raw payload so it always has a `type` field. */
  function normalizePayload(
    raw: Record<string, unknown>
  ): Record<string, unknown> {
    // Stringified 'data' sub-field (backend pattern)
    if (typeof raw.data === "string") {
      const parsed = tryParseJSON(raw.data as string);
      if (parsed) {
        return {
          ...parsed,
          type: (parsed as { type?: string }).type || raw.type,
        };
      }
    }

    if ("messageType" in raw && "payload" in raw) {
      return { ...(raw.payload as object), type: raw.messageType };
    }

    if ("payload" in raw && !("type" in raw)) {
      return {
        ...(raw.payload as object),
        type: raw.action_type || "unknown",
      };
    }

    if ("action_type" in raw && !("type" in raw)) {
      return { ...raw, type: raw.action_type };
    }

    return raw;
  }

  /** Generate a conversation-list preview string for a given message type. */
  function generatePreview(
    type: string,
    data: Record<string, unknown>
  ): string {
    switch (type) {
      case "image":
        return "Photo";
      case "file":
        return data.fileName ? `📎 ${data.fileName}` : "File";
      case "audio":
        return "Audio";
      case "text":
        return (data.body as string) ?? "";
      case "call":
        return `${data.callType === "video" ? "Video" : "Audio"} call`;
      case "meal_plan_updated":
      case "meal_plan_update":
        return "Meal plan updated";
      case "new_nutritionist":
      case "new_nutrionist":
      case "coach_assigned":
      case "coach_details":
        return (
          (data.title as string) ||
          (data.name as string) ||
          "New nutritionist assigned"
        );
      case "products":
      case "recommended_products":
        return "Products";
      case "general_notification":
      case "general-notification":
        return (data.title as string) || "Notification";
      case "video_call":
        return (data.title as string) || "Video call";
      case "voice_call":
        return (data.title as string) || "Voice call";
      case "documents":
        return (data.title as string) || "Document";
      case "call_scheduled": {
        const time = data.time as number | string | undefined;
        if (time) {
          const ms =
            typeof time === "number"
              ? time * 1000
              : parseInt(String(time), 10) * 1000;
          return `Schedule, ${formatScheduledDate(new Date(ms))}`;
        }
        return "Call scheduled";
      }
      case "scheduled_call_canceled":
        return "Scheduled call cancelled";
      default:
        return "Attachment";
    }
  }

  /** Trigger the incoming-call handler when a message is a call initiation. */
  function checkCallInitiation(data: Record<string, unknown>): void {
    const t = String(data.type || "").toLowerCase();
    if (t !== "call" || data.action !== "initiate" || !handleIncomingCall)
      return;
    if (!data.channel || !data.from) return;
    handleIncomingCall({
      from: data.from as string,
      channel: data.channel as string,
      callId: data.channel as string,
      callType:
        data.callType === "video" || data.callType === "audio"
          ? (data.callType as "video" | "audio")
          : "video",
    });
  }

  /** Update conversation list with a new message preview. */
  function updateConversationList(fromId: string, preview: string): void {
    const withPrefix = fromId.startsWith("user_")
      ? fromId
      : `user_${fromId}`;
    const withoutPrefix = fromId.startsWith("user_")
      ? fromId.replace("user_", "")
      : fromId;

    setConversations((prev) => {
      const existing = prev.find(
        (c) =>
          c.id === fromId ||
          c.id === withPrefix ||
          c.id === withoutPrefix ||
          c.id === `user_${withoutPrefix}`
      );

      if (existing) {
        return prev.map((conv) =>
          conv.id === existing.id
            ? {
                ...conv,
                lastMessage: preview,
                timestamp: new Date(),
                lastMessageFrom: fromId,
              }
            : conv
        );
      }

      return [
        {
          id: withPrefix,
          name: withoutPrefix,
          lastMessage: preview,
          timestamp: new Date(),
          avatar: config.defaults.avatar,
          replyCount: 0,
          lastSeen: "",
          lastMessageFrom: fromId,
        },
        ...prev,
      ];
    });
  }

  // ---------------------------------------------------------------------------
  // Custom-message handler (extracted so onTextMessage can delegate to it)
  // ---------------------------------------------------------------------------

  const handleCustomMessage = (msg: MessageBody): void => {
    const fromId = msg.from || "";
    if (isBlockedUID(fromId)) return;

    const raw = extractCustomPayload(msg);
    const normalized = raw ? normalizePayload(raw) : null;

    const type = normalized
      ? String(normalized.type || normalized.action_type || "").toLowerCase()
      : "";

    const preview = type && normalized
      ? generatePreview(type, normalized)
      : "Attachment";

    const messageContent =
      normalized && Object.keys(normalized).length > 0
        ? JSON.stringify(normalized)
        : JSON.stringify(msg);

    if (normalized) checkCallInitiation(normalized);

    if (shouldSuppressMultiDeviceSessionChatPayload(messageContent)) return;

    const isSelf = fromId === userId || String(fromId) === String(userId);
    const prefix = isSelf ? `You → ${msg.to || "unknown"}` : `${msg.from}`;

    addLog({
      log: `${prefix}: ${messageContent}`,
      timestamp: new Date(),
      serverMsgId:
        (msg as { id?: string; mid?: string }).id ||
        (msg as { id?: string; mid?: string }).mid,
    });

    if (msg.from && !isSelf) {
      updateConversationList(fromId, preview);
    }
  };

  // ---------------------------------------------------------------------------
  // Return handlers
  // ---------------------------------------------------------------------------

  return {
    onConnected: () => {
      setIsLoggedIn(true);
      setIsLoggingIn(false);
      addLog(`User ${userId} connected`);
    },

    onDisconnected: (error?: { type?: unknown }) => {
      setIsLoggedIn(false);
      if (isAgoraSessionConflictError(error)) {
        onSessionConflictFromOtherClient?.();
        addLog(
          "Disconnected: same account connected in another tab or device (auto-reconnect paused)"
        );
        return;
      }
      addLog("Disconnected");
    },

    // ---- Text messages only ----
    onTextMessage: (msg: MessageBody) => {
      const fromId = msg.from || "";
      if (isBlockedUID(fromId)) return;

      // Agora may deliver custom messages through the text callback
      if (msg.type === "custom") {
        handleCustomMessage(msg);
        return;
      }

      let preview: string = msg.msg || "";
      let messageToLog: string = msg.msg || "";

      // Parse JSON-encoded text messages for structured preview & call initiation
      if (typeof msg.msg === "string" && msg.msg.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(msg.msg as string);
          if (parsed && typeof parsed === "object") {
            const normalized = normalizePayload(parsed);
            const type = String(
              normalized.type || normalized.action_type || ""
            ).toLowerCase();

            if (type) {
              preview = generatePreview(type, normalized);
              checkCallInitiation(normalized);

              if (JSON.stringify(normalized) !== JSON.stringify(parsed)) {
                messageToLog = JSON.stringify(normalized);
              }
            }
          }
        } catch {
          // Not valid JSON — preview stays as raw text
        }
      }

      if (shouldSuppressMultiDeviceSessionChatPayload(String(messageToLog)))
        return;

      const isSelf = fromId === userId || String(fromId) === String(userId);
      const prefix = isSelf
        ? `You → ${msg.to || "unknown"}`
        : `${msg.from}`;

      addLog({
        log: `${prefix}: ${messageToLog}`,
        timestamp: new Date(),
        serverMsgId:
          (msg as { id?: string; mid?: string }).id ||
          (msg as { id?: string; mid?: string }).mid,
      });

      if (msg.from && !isSelf) {
        updateConversationList(fromId, preview);
      }
    },

    // ---- Custom messages only ----
    onCustomMessage: handleCustomMessage,

    // ---- Remaining handlers (unchanged) ----

    onModifiedMessage: (msg: MessageBody): void => {
      const fromId = msg.from || "";
      if (isBlockedUID(fromId)) return;

      const messageId =
        (msg as { id?: string; mid?: string }).id ||
        (msg as { id?: string; mid?: string }).mid ||
        `${msg.from}-${msg.time}`;

      const messageContent = msg.msg || msg.msgContent || msg.data || "";

      if (
        shouldSuppressMultiDeviceSessionChatPayload(String(messageContent))
      )
        return;

      const msgId = (msg as { id?: string; mid?: string }).id;
      const msgMid = (msg as { id?: string; mid?: string }).mid;
      const messageIdForEditing = msgMid || msgId || messageId;

      addLog({
        serverMsgId: messageIdForEditing,
        mid: msgMid || msgId,
        log: `${msg.from}: ${messageContent}`,
        timestamp:
          msg.time && typeof msg.time === "number"
            ? new Date(msg.time)
            : new Date(),
        isEdited: true,
      } as LogEntry);
    },

    onTokenWillExpire: async (): Promise<void> => {
      addLog("Token will expire soon - renewing...");
      const newToken = await generateNewToken();
      const client = getClientRef() as {
        renewToken?: (token: string) => Promise<void>;
      } | null;
      if (newToken && client && typeof client.renewToken === "function") {
        try {
          await client.renewToken(newToken);
          addLog("Token renewed successfully");
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          addLog(`Token renewal failed: ${errorMessage}`);
        }
      }
    },

    onTokenExpired: async (): Promise<void> => {
      addLog("Token expired - attempting to renew...");
      setIsLoggedIn(false);

      const newToken = await generateNewToken();
      const client = getClientRef() as {
        open?: (options: {
          user: string;
          accessToken: string;
        }) => Promise<void>;
      } | null;
      if (newToken && client && userId && typeof client.open === "function") {
        try {
          await client.open({ user: userId, accessToken: newToken });
          addLog("Reconnected with new token");
          setIsLoggedIn(true);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          addLog(`Reconnection failed: ${errorMessage}`);
          setIsLoggingIn(false);
        }
      } else {
        addLog(
          "Cannot reconnect: Token generation failed or client unavailable"
        );
        setIsLoggingIn(false);
      }
    },

    onError: async (e: {
      message: string;
      code?: string;
      type?: number | string;
    }): Promise<void> => {
      const errorMessage = e.message || "";
      const typeNum =
        typeof e.type === "number"
          ? e.type
          : typeof e.type === "string"
            ? Number(e.type)
            : undefined;
      if (
        typeNum === AGORA_LOGIN_ANOTHER_DEVICE ||
        typeNum === AGORA_KICKED_BY_OTHER_DEVICE
      ) {
        setIsLoggedIn(false);
        onSessionConflictFromOtherClient?.();
        addLog(
          `Chat session taken elsewhere: ${errorMessage || "another tab or device"}`
        );
        setIsLoggingIn(false);
        return;
      }
      addLog(`Error: ${errorMessage}`);
      setIsLoggingIn(false);
    },

    onPresenceStatus: onPresenceStatus
      ? (presenceData: { userId: string; description: string }): void => {
          addLog(
            `Presence update from ${presenceData.userId}: ${presenceData.description}`
          );
          onPresenceStatus(presenceData);
        }
      : undefined,
  };
}
