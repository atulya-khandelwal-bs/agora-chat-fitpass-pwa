import config from "../../common/config.ts";
import type {
  Contact,
  Message,
  CoachInfo,
  SystemMessageData,
  Product,
} from "../../common/types/chat";
import type { ApiMessage } from "../services/chatApi";
import { shouldSuppressMultiDeviceSessionChatPayload } from "./chatPayloadFilters.ts";

interface AgoraMessage {
  id?: string;
  mid?: string; // Message ID from delivery receipt (used for editing)
  from?: string;
  to?: string;
  time?: number;
  type?: string;
  msg?: string;
  msgContent?: string;
  data?: string;
  body?: string | object;
  customExts?: object;
  "v2:customExts"?: object;
  ext?: {
    type?: string;
    url?: string;
    fileName?: string;
    mimeType?: string;
    size?: number | string;
    duration?: number | string;
    transcription?: string;
    data?: string | object;
    [key: string]: unknown;
  };
  sender_photo?: string;
  createdAt?: number | Date;
  chat_type?: string;
  conversation_id?: string;
  message_id?: string;
  from_user?: string;
  to_user?: string;
  sender_name?: string;
  message_type?: string;
  created_at?: string | number;
  created_at_ms?: number;
  isFromUser?: boolean;
  target_user_id?: number;
  chat_group_id?: string;
  [key: string]: unknown;
}

interface CustomMessageData {
  type?: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  size?: number | string;
  duration?: number | string;
  transcription?: string;
  products?: Product[] | string;
  callType?: string;
  channel?: string;
  action?: string;
  id?: string;
  name?: string;
  title?: string;
  profilePhoto?: string;
  time?: number | string; // Epoch time in seconds (for call_scheduled/scheduled_call_canceled)
  [key: string]: unknown;
}

interface MealPlanIconsDetails {
  left_icon?: string;
  right_icon?: string;
}

interface MealPlanRedirectionDetail {
  cta_details?: Record<string, unknown>;
  redirect_url?: string;
  action_id?: string;
}

interface MealPlanPayload {
  action_type?: string;
  title?: string;
  description?: string;
  icons_details?: MealPlanIconsDetails;
  redirection_details?: MealPlanRedirectionDetail[];
}

interface SystemPayload {
  kind:
    | "meal_plan_updated"
    | "new_nutritionist"
    | "general_notification"
    | "video_call"
    | "voice_call"
    | "documents";
  payload: {
    type?: string;
    messageType?: string;
    id?: string;
    name?: string;
    title?: string;
    profilePhoto?: string;
    action_type?: string;
    description?: string;
    icons_details?: MealPlanIconsDetails;
    redirection_details?: MealPlanRedirectionDetail[];
    [key: string]: unknown;
  };
}

// Helper function to extract custom message data from Agora Chat message
export const extractCustomMessageData = (
  msg: AgoraMessage
): CustomMessageData | null => {
  let paramsData = null;

  // Try customExts at top level
  if (msg.customExts && typeof msg.customExts === "object") {
    const customExts = msg.customExts as {
      type?: string;
      data?: string | object;
      [key: string]: unknown;
    };

    // If customExts has a 'data' field that's a JSON string, parse it
    if (customExts.data) {
      try {
        paramsData =
          typeof customExts.data === "string"
            ? JSON.parse(customExts.data)
            : customExts.data;
        // If type is in customExts but not in parsed data, add it
        if (customExts.type && !paramsData.type) {
          paramsData = { ...paramsData, type: customExts.type };
        }
      } catch {
        // If parsing fails, use customExts directly
        paramsData = customExts;
      }
    } else {
      // No data field, use customExts directly
      paramsData = customExts;
    }
  }
  // Try v2:customExts at top level
  else if (msg["v2:customExts"] && typeof msg["v2:customExts"] === "object") {
    const v2CustomExts = msg["v2:customExts"] as {
      type?: string;
      data?: string | object;
      [key: string]: unknown;
    };

    // If v2:customExts has a 'data' field that's a JSON string, parse it
    if (v2CustomExts.data) {
      try {
        paramsData =
          typeof v2CustomExts.data === "string"
            ? JSON.parse(v2CustomExts.data)
            : v2CustomExts.data;
        // If type is in v2CustomExts but not in parsed data, add it
        if (v2CustomExts.type && !paramsData.type) {
          paramsData = { ...paramsData, type: v2CustomExts.type };
        }
      } catch {
        // If parsing fails, use v2CustomExts directly
        paramsData = v2CustomExts;
      }
    } else {
      // No data field, use v2CustomExts directly
      paramsData = v2CustomExts;
    }
  }
  // Try body.customExts
  else if (msg.body && typeof msg.body === "object") {
    const bodyObj = msg.body as {
      customExts?: {
        type?: string;
        data?: string | object;
        [key: string]: unknown;
      };
      "v2:customExts"?: {
        type?: string;
        data?: string | object;
        [key: string]: unknown;
      };
    };
    if (bodyObj.customExts) {
      const customExts = bodyObj.customExts;
      if (customExts.data) {
        try {
          paramsData =
            typeof customExts.data === "string"
              ? JSON.parse(customExts.data)
              : customExts.data;
          if (customExts.type && !paramsData.type) {
            paramsData = { ...paramsData, type: customExts.type };
          }
        } catch {
          paramsData = customExts;
        }
      } else {
        paramsData = customExts;
      }
    }
    // Try body.v2:customExts
    else if (bodyObj["v2:customExts"]) {
      const v2CustomExts = bodyObj["v2:customExts"];
      if (v2CustomExts.data) {
        try {
          paramsData =
            typeof v2CustomExts.data === "string"
              ? JSON.parse(v2CustomExts.data)
              : v2CustomExts.data;
          if (v2CustomExts.type && !paramsData.type) {
            paramsData = { ...paramsData, type: v2CustomExts.type };
          }
        } catch {
          paramsData = v2CustomExts;
        }
      } else {
        paramsData = v2CustomExts;
      }
    }
  }
  // Try ext properties directly
  else if (msg.ext && typeof msg.ext === "object") {
    if (
      msg.ext.type &&
      (msg.ext.type === "image" ||
        msg.ext.type === "file" ||
        msg.ext.type === "audio")
    ) {
      paramsData = {
        type: msg.ext.type,
        url: msg.ext.url,
        fileName: msg.ext.fileName,
        mimeType: msg.ext.mimeType,
        size: msg.ext.size,
        duration: msg.ext.duration,
        transcription: msg.ext.transcription,
      };
    } else if (msg.ext.data) {
      try {
        paramsData =
          typeof msg.ext.data === "string"
            ? JSON.parse(msg.ext.data)
            : msg.ext.data;
      } catch {
        // Parse failed - paramsData stays undefined
      }
    }
  }

  return paramsData as CustomMessageData | null;
};

// Helper function to parse system payload
export const parseSystemPayload = (
  rawContent: string
): SystemPayload | null => {
  try {
    const obj = JSON.parse(rawContent);
    if (!obj || typeof obj !== "object") return null;

    // Check for new format: { messageType, payload }
    if (obj.messageType) {
      const normalizedType = String(obj.messageType).toLowerCase();
      if (
        normalizedType === "meal_plan_updated" ||
        normalizedType === "mealplanupdated" ||
        normalizedType === "meal_plan_update"
      ) {
        return {
          kind: "meal_plan_updated",
          payload: obj.payload || obj,
        };
      }
      if (
        normalizedType === "new_nutritionist" ||
        normalizedType === "newnutritionist" ||
        normalizedType === "new_nutritionist_assigned" ||
        normalizedType === "coach_assigned" ||
        normalizedType === "coach_details"
      ) {
        return {
          kind: "new_nutritionist",
          payload: obj.payload || obj,
        };
      }
      if (
        normalizedType === "general_notification" ||
        normalizedType === "general-notification"
      ) {
        return {
          kind: "general_notification",
          payload: obj.payload || obj,
        };
      }
      if (normalizedType === "video_call" || normalizedType === "video-call") {
        return {
          kind: "video_call",
          payload: obj.payload || obj,
        };
      }
      if (normalizedType === "voice_call" || normalizedType === "voice-call") {
        return {
          kind: "voice_call",
          payload: obj.payload || obj,
        };
      }
    }

    // Check for old format: { type, ... }
    if (obj.type) {
      const normalizedType = String(obj.type).toLowerCase();
      if (
        normalizedType === "meal_plan_updated" ||
        normalizedType === "mealplanupdated" ||
        normalizedType === "meal_plan_update"
      ) {
        return { kind: "meal_plan_updated", payload: obj };
      }
      if (
        normalizedType === "new_nutritionist" ||
        normalizedType === "newnutritionist" ||
        normalizedType === "new_nutritionist_assigned" ||
        normalizedType === "coach_assigned" ||
        normalizedType === "coach_details"
      ) {
        return { kind: "new_nutritionist", payload: obj };
      }
      if (
        normalizedType === "general_notification" ||
        normalizedType === "general-notification"
      ) {
        return { kind: "general_notification", payload: obj };
      }
      if (normalizedType === "video_call" || normalizedType === "video-call") {
        return { kind: "video_call", payload: obj };
      }
      if (normalizedType === "voice_call" || normalizedType === "voice-call") {
        return { kind: "voice_call", payload: obj };
      }
      if (normalizedType === "documents") {
        return { kind: "documents", payload: obj };
      }
    }

    // Check for old format: { type, ... }
    if (obj.type) {
      const normalizedType = String(obj.type).toLowerCase();
      if (
        normalizedType === "meal_plan_updated" ||
        normalizedType === "mealplanupdated" ||
        normalizedType === "meal_plan_update"
      ) {
        return { kind: "meal_plan_updated", payload: obj };
      }
      if (
        normalizedType === "new_nutritionist" ||
        normalizedType === "newnutritionist" ||
        normalizedType === "new_nutritionist_assigned" ||
        normalizedType === "coach_assigned" ||
        normalizedType === "coach_details"
      ) {
        return { kind: "new_nutritionist", payload: obj };
      }
      if (
        normalizedType === "general_notification" ||
        normalizedType === "general-notification"
      ) {
        return { kind: "general_notification", payload: obj };
      }
      if (normalizedType === "video_call" || normalizedType === "video-call") {
        return { kind: "video_call", payload: obj };
      }
      if (normalizedType === "voice_call" || normalizedType === "voice-call") {
        return { kind: "voice_call", payload: obj };
      }
      if (normalizedType === "documents") {
        return { kind: "documents", payload: obj };
      }
    }

    return null;
  } catch {
    return null;
  }
};

// Helper: label text for system payload cards
export const getSystemLabel = (
  system: SystemMessageData | null | undefined
): string => {
  if (!system) return "";
  switch (system.kind) {
    case "meal_plan_updated":
      return "Meal plan updated";
    case "new_nutritionist":
      return "New nutritionist assigned";
    default:
      return "System message";
  }
};

// Helper function to format a message from Agora Chat SDK
export const formatMessage = (
  msg: AgoraMessage | ApiMessage | string | null | undefined,
  userId: string,
  peerId: string,
  selectedContact: Contact | null,
  coachInfo: CoachInfo
): Message | null => {
  // Check if this is a backend API message format (has keys like body, chat_type, conversation_id, etc.)
  if (
    msg &&
    typeof msg === "object" &&
    !("id" in msg && msg.id) &&
    !("from" in msg && msg.from) &&
    !("time" in msg && msg.time) &&
    (("body" in msg && msg.body !== undefined) ||
      ("chat_type" in msg && msg.chat_type !== undefined) ||
      ("conversation_id" in msg && msg.conversation_id !== undefined) ||
      ("message_id" in msg && msg.message_id !== undefined))
  ) {
    // This is a backend API message format - convert it to Agora format
    const backendMsg = msg as ApiMessage;
    // Ensure body is a string
    let bodyContent = backendMsg.body || "";
    if (typeof bodyContent !== "string") {
      if (bodyContent && typeof bodyContent === "object") {
        bodyContent = JSON.stringify(bodyContent);
      } else {
        bodyContent = String(bodyContent);
      }
    }
    const agoraMsg: AgoraMessage = {
      id: backendMsg.message_id || `backend-${Date.now()}-${Math.random()}`,
      from: backendMsg.from_user || backendMsg.sender_name || userId,
      to: backendMsg.to_user || peerId,
      time:
        typeof backendMsg.created_at_ms === "number"
          ? backendMsg.created_at_ms
          : typeof backendMsg.created_at === "number"
          ? backendMsg.created_at
          : typeof backendMsg.created_at === "string"
          ? new Date(backendMsg.created_at).getTime()
          : Date.now(),
      type: backendMsg.message_type === "text" ? "txt" : "custom",
      msg: bodyContent,
      msgContent: bodyContent,
      data: bodyContent,
      isFromUser: apiMessageIsFromUser(backendMsg),
      target_user_id: backendMsg.target_user_id,
      chat_group_id: backendMsg.chat_group_id,
      sender_photo: backendMsg.sender_photo,
      sender_name: backendMsg.sender_name,
      message_type: backendMsg.message_type,
      chat_type: backendMsg.chat_type,
      conversation_id: backendMsg.conversation_id,
      message_id: backendMsg.message_id,
      from_user: backendMsg.from_user,
      to_user: backendMsg.to_user,
      created_at: backendMsg.created_at,
      created_at_ms: backendMsg.created_at_ms,
    };
    msg = agoraMsg;
  }

  // Ensure msg has required properties
  if (!msg || typeof msg !== "object" || typeof msg === "string") {
    return {
      id: `invalid-${Date.now()}`,
      sender: "Unknown",
      content: typeof msg === "string" ? msg : JSON.stringify(msg || {}),
      createdAt: new Date(),
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      isIncoming: true,
      peerId,
      avatar: config.defaults.avatar,
      messageType: "text",
    };
  }

  // At this point, msg should be AgoraMessage (converted from ApiMessage if needed)
  const agoraMsg = msg as AgoraMessage;

  const fromCurrentUser =
    typeof agoraMsg.isFromUser === "boolean"
      ? agoraMsg.isFromUser
      : agoraMsg.from === userId;

  // Determine avatar: use sender_photo from API if available, otherwise use defaults
  let messageAvatar: string | null = null;
  if (agoraMsg.sender_photo) {
    // Use sender_photo from API message (for both incoming and outgoing)
    messageAvatar = agoraMsg.sender_photo;
  } else if (fromCurrentUser) {
    // Outgoing message from current user - use coach's profile photo
    messageAvatar = coachInfo?.profilePhoto || config.defaults.userAvatar;
  } else {
    // Incoming message - use selectedContact avatar or default
    messageAvatar = selectedContact?.avatar || config.defaults.avatar;
  }

  const baseMessage = {
    id: agoraMsg.id || `msg-${Date.now()}-${Math.random()}`,
    sender: fromCurrentUser ? "You" : agoraMsg.from || "Unknown",
    createdAt: new Date(agoraMsg.time || agoraMsg.createdAt || Date.now()),
    timestamp: new Date(
      agoraMsg.time || agoraMsg.createdAt || Date.now()
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    isIncoming: !fromCurrentUser,
    peerId,
    avatar: messageAvatar,
    mid: agoraMsg.mid, // Preserve mid for message editing
    serverMsgId: agoraMsg.id, // Preserve server message ID for matching edited messages
    ...(agoraMsg.target_user_id !== undefined
      ? { targetUserId: agoraMsg.target_user_id }
      : {}),
    ...(agoraMsg.chat_group_id !== undefined
      ? { chatGroupId: agoraMsg.chat_group_id }
      : {}),
  };

  // Handle custom messages
  if (agoraMsg.type === "custom") {
    const customData = extractCustomMessageData(agoraMsg);


    if (customData && customData.type) {
      const type = String(customData.type).toLowerCase();

      // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
      if (
        type === "healthcoachchanged" ||
        type === "mealplanupdate" ||
        type === "healthcoachchangedate" ||
        type === "mealplanupdate" ||
        type === "healthCoachChanged" ||
        type === "mealPlanUpdate"
      ) {
        return null; // Don't show these messages on UI
      }

      const content = JSON.stringify(customData);

      if (type === "image") {
        return {
          ...baseMessage,
          content,
          messageType: "image",
          imageUrl: customData.url || "",
          fileName: customData.fileName,
        };
      } else if (type === "audio") {
        // Convert duration to milliseconds if it appears to be in seconds (< 3600)
        let durationMs: number | string | undefined = customData.duration;
        if (typeof durationMs === "number" && durationMs < 3600) {
          durationMs = durationMs * 1000; // Convert seconds to milliseconds
        }
        return {
          ...baseMessage,
          content,
          messageType: "audio",
          audioUrl: customData.url || "",
          audioDurationMs:
            typeof durationMs === "number"
              ? durationMs
              : typeof durationMs === "string"
              ? parseFloat(durationMs) * 1000
              : undefined,
          audioTranscription: customData.transcription,
          fileName: customData.fileName,
        };
      } else if (type === "file") {
        return {
          ...baseMessage,
          content,
          messageType: "file",
          fileUrl: customData.url || "",
          fileName: customData.fileName,
          fileMime: customData.mimeType,
          fileSizeBytes:
            typeof customData.size === "number"
              ? customData.size
              : typeof customData.size === "string"
              ? parseInt(customData.size, 10)
              : undefined,
        };
      } else if (type === "video_call" || type === "voice_call") {
        const callPayload = customData as {
          title?: string;
          description?: string;
          icons_details?: MealPlanIconsDetails;
          call_details?: {
            call_url?: string;
          };
          redirection_details?: MealPlanRedirectionDetail[];
          // Also check for action_type format (from Agora messages)
          action_type?: string;
        };

        // Extract call_details - it should be in callPayload.call_details
        let finalCallDetails = callPayload.call_details;

        // If call_details is not directly available, check if it's nested differently
        if (!finalCallDetails) {
          // Try to find call_details in the payload
          const payload = callPayload as Record<string, unknown>;
          if (
            payload.call_details &&
            typeof payload.call_details === "object"
          ) {
            finalCallDetails = payload.call_details as { call_url?: string };
          }
        }


        return {
          ...baseMessage,
          content:
            callPayload.title ||
            callPayload.description ||
            (type === "video_call" ? "Video call" : "Voice call"),
          messageType: type === "video_call" ? "video_call" : "voice_call",
          system: {
            kind: type === "video_call" ? "video_call" : "voice_call",
            payload: {
              title: callPayload.title,
              description: callPayload.description,
              icons_details: callPayload.icons_details,
              call_details: finalCallDetails,
              redirection_details: callPayload.redirection_details,
            } as SystemMessageData["payload"] & {
              title?: string;
              description?: string;
              icons_details?: MealPlanIconsDetails;
              call_details?: {
                call_url?: string;
              };
              redirection_details?: MealPlanRedirectionDetail[];
            },
          },
        };
      } else if (type === "documents") {
        const documentsPayload = customData as {
          title?: string;
          description?: string;
          icons_details?: MealPlanIconsDetails;
          documents_details?: {
            document_url?: string;
            document_size?: number;
            document_type?: string;
          };
          redirection_details?: MealPlanRedirectionDetail[];
        };

        return {
          ...baseMessage,
          content:
            documentsPayload.title ||
            documentsPayload.description ||
            "Document",
          messageType: "documents",
          system: {
            kind: "documents",
            payload: {
              title: documentsPayload.title,
              description: documentsPayload.description,
              icons_details: documentsPayload.icons_details,
              documents_details: documentsPayload.documents_details,
              redirection_details: documentsPayload.redirection_details,
            } as SystemMessageData["payload"] & {
              title?: string;
              description?: string;
              icons_details?: MealPlanIconsDetails;
              documents_details?: {
                document_url?: string;
                document_size?: number;
                document_type?: string;
              };
              redirection_details?: MealPlanRedirectionDetail[];
            },
          },
          // Also set file properties for compatibility with FPFileMessageView
          fileUrl: documentsPayload.documents_details?.document_url,
          fileName: documentsPayload.title,
          fileMime: documentsPayload.documents_details?.document_type,
          fileSizeBytes: documentsPayload.documents_details?.document_size,
        };
      } else if (
        type === "call_scheduled" ||
        type === "scheduled_call_canceled"
      ) {
        const callScheduledData = customData as {
          time?: number | string;
        };


        // Parse time - handle both string and number formats
        let scheduledTime: number | undefined;
        if (callScheduledData.time !== undefined) {
          scheduledTime =
            typeof callScheduledData.time === "number"
              ? callScheduledData.time
              : typeof callScheduledData.time === "string"
              ? parseInt(callScheduledData.time, 10)
              : undefined;
        }


        // Format the scheduled time for display
        const scheduledDate = scheduledTime
          ? new Date(scheduledTime * 1000) // Convert seconds to milliseconds
          : null;

        // Format date as "11 Aug 10:00 am" (12-hour format with AM/PM)
        const formatScheduledDate = (date: Date): string => {
          const day = date.getDate();
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          const month = monthNames[date.getMonth()];
          let hours = date.getHours();
          const minutes = date.getMinutes();
          const ampm = hours >= 12 ? "pm" : "am";
          hours = hours % 12;
          hours = hours ? hours : 12; // the hour '0' should be '12'
          const minutesStr = minutes < 10 ? `0${minutes}` : minutes;
          return `${day} ${month} ${hours}:${minutesStr} ${ampm}`;
        };

        const isCancelled = type === "scheduled_call_canceled";
        const displayText = isCancelled
          ? "Scheduled call cancelled"
          : scheduledDate
          ? `Schedule, ${formatScheduledDate(scheduledDate)}`
          : "Call scheduled";

        return {
          ...baseMessage,
          content: displayText,
          messageType: type, // "call_scheduled" or "scheduled_call_canceled"
          system: {
            kind: type,
            payload: {
              time: scheduledTime,
              scheduledDate: scheduledDate?.toISOString(),
            } as SystemMessageData["payload"] & {
              time?: number;
              scheduledDate?: string;
            },
          },
        };
      } else if (type === "products" || type === "recommended_products") {
        // Handle case where products might be a stringified JSON string
        // Also handle 'product_list' field for recommended_products
        let productsArray: Product[] = [];
        if (Array.isArray(customData.products)) {
          productsArray = customData.products as Product[];
        } else if (
          Array.isArray(
            (customData as { product_list?: Product[] }).product_list
          )
        ) {
          productsArray = (customData as { product_list: Product[] })
            .product_list;
        } else if (typeof customData.products === "string") {
          try {
            const parsed = JSON.parse(customData.products);
            productsArray = Array.isArray(parsed) ? (parsed as Product[]) : [];
          } catch {
            productsArray = [];
          }
        }

        // Filter out products messages with 0 products
        if (productsArray.length === 0) {
          return null; // Don't show products messages with no products
        }

        return {
          ...baseMessage,
          content,
          messageType: "products",
          products: productsArray,
        };
      } else if (type === "meal_plan_updated" || type === "meal_plan_update") {
        const mealPlanPayload = customData as MealPlanPayload & {
          type?: string;
          id?: string;
        };
        return {
          ...baseMessage,
          content:
            mealPlanPayload.title ||
            mealPlanPayload.description ||
            "Meal plan updated",
          messageType: "system",
          system: {
            kind: "meal_plan_updated",
            payload: {
              id: mealPlanPayload.id,
              action_type: mealPlanPayload.action_type,
              title: mealPlanPayload.title,
              description: mealPlanPayload.description,
              icons_details: mealPlanPayload.icons_details,
              redirection_details: mealPlanPayload.redirection_details,
            } as SystemMessageData["payload"] & {
              action_type?: string;
              description?: string;
              icons_details?: MealPlanIconsDetails;
              redirection_details?: MealPlanRedirectionDetail[];
            },
          },
        };
      } else if (
        type === "new_nutritionist" ||
        type === "new_nutrionist" ||
        type === "coach_assigned" ||
        type === "coach_details"
      ) {
        // Extract data from payload structure for coach_assigned/coach_details
        const nutritionistData = customData as {
          id?: string;
          name?: string;
          title?: string;
          profilePhoto?: string;
          action_type?: string;
          description?: string;
          icons_details?: MealPlanIconsDetails;
          redirection_details?: MealPlanRedirectionDetail[] | string;
        };

        // For coach_assigned/coach_details, extract from title/description/icons_details
        const name = nutritionistData.name || nutritionistData.title || "";
        const title =
          nutritionistData.title || nutritionistData.description || "";
        const profilePhoto =
          nutritionistData.profilePhoto ||
          nutritionistData.icons_details?.left_icon ||
          "";

        // Parse redirection_details if it's a string
        let redirectionDetails: MealPlanRedirectionDetail[] | undefined;
        if (nutritionistData.redirection_details) {
          if (typeof nutritionistData.redirection_details === "string") {
            try {
              redirectionDetails = JSON.parse(
                nutritionistData.redirection_details
              );
            } catch {
              // If parsing fails, keep as undefined
              redirectionDetails = undefined;
            }
          } else if (Array.isArray(nutritionistData.redirection_details)) {
            redirectionDetails = nutritionistData.redirection_details;
          }
        }

        return {
          ...baseMessage,
          content: name || title || "New nutritionist assigned",
          messageType: "system",
          system: {
            kind: "new_nutritionist",
            id: nutritionistData.id || "",
            name: name,
            title: title,
            profilePhoto: profilePhoto,
            payload: {
              action_type:
                nutritionistData.action_type ||
                (type === "coach_assigned"
                  ? "coach_assigned"
                  : type === "coach_details"
                  ? "coach_details"
                  : undefined),
              title: nutritionistData.title || title,
              description: nutritionistData.description || "",
              icons_details: nutritionistData.icons_details,
              redirection_details: redirectionDetails,
            },
          },
        };
      } else if (
        type === "general_notification" ||
        type === "general-notification"
      ) {
        const notificationPayload = customData as {
          action_type?: string;
          title?: string;
          description?: string;
          redirection_details?: MealPlanRedirectionDetail[] | string;
        };

        // Parse redirection_details if it's a string
        let redirectionDetails: MealPlanRedirectionDetail[] | undefined;
        if (notificationPayload.redirection_details) {
          if (typeof notificationPayload.redirection_details === "string") {
            try {
              redirectionDetails = JSON.parse(
                notificationPayload.redirection_details
              );
            } catch {
              redirectionDetails = undefined;
            }
          } else if (Array.isArray(notificationPayload.redirection_details)) {
            redirectionDetails = notificationPayload.redirection_details;
          }
        }

        return {
          ...baseMessage,
          content:
            notificationPayload.title ||
            notificationPayload.description ||
            "Notification",
          messageType: "general_notification",
          system: {
            kind: "general_notification",
            payload: {
              action_type: notificationPayload.action_type,
              title: notificationPayload.title,
              description: notificationPayload.description,
              redirection_details: redirectionDetails,
            } as SystemMessageData["payload"] & {
              action_type?: string;
              description?: string;
              redirection_details?: MealPlanRedirectionDetail[];
            },
          },
        };
      }
    }

    // Fallback for custom messages without valid data
    let fallbackContent =
      agoraMsg.msg || agoraMsg.msgContent || agoraMsg.data || "";
    // Ensure content is always a string
    if (typeof fallbackContent !== "string") {
      if (fallbackContent && typeof fallbackContent === "object") {
        // If it's an object, try to extract body or stringify it
        const contentObj = fallbackContent as { body?: string };
        fallbackContent = contentObj.body || JSON.stringify(fallbackContent);
      } else {
        fallbackContent = String(fallbackContent);
      }
    }
    return {
      ...baseMessage,
      content: fallbackContent,
      messageType: "custom",
    };
  }

  // Handle text messages - check if it's JSON with a type field
  let textContent = agoraMsg.msg || agoraMsg.msgContent || agoraMsg.data || "";
  // Ensure textContent is always a string
  if (typeof textContent !== "string") {
    if (textContent && typeof textContent === "object") {
      // If it's an object, try to extract body or stringify it
      const contentObj = textContent as { body?: string };
      textContent = contentObj.body || JSON.stringify(textContent);
    } else {
      textContent = String(textContent);
    }
  }
  try {
    const parsed = JSON.parse(textContent);
    if (parsed && typeof parsed === "object") {
      // Handle new format: { messageType, payload }
      let type: string | undefined;
      let payloadData: unknown = parsed;

      if (parsed.messageType) {
        type = String(parsed.messageType).toLowerCase();
        payloadData = parsed.payload || parsed;
      } else if (parsed.type) {
        type = String(parsed.type).toLowerCase();
        payloadData = parsed;
      }

      if (type) {
        // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
        if (
          type === "healthcoachchanged" ||
          type === "mealplanupdate" ||
          type === "mealplanupdated" ||
          type === "healthCoachChanged" ||
          type === "mealPlanUpdate"
        ) {
          return null; // Don't show these messages on UI
        }

        if (type === "products" || type === "recommended_products") {
          const productsData = payloadData as {
            products?: Product[] | string;
            product_list?: Product[];
          };
          let productsArray: Product[] = [];
          if (Array.isArray(productsData.products)) {
            productsArray = productsData.products;
          } else if (Array.isArray(productsData.product_list)) {
            productsArray = productsData.product_list;
          } else if (typeof productsData.products === "string") {
            try {
              const parsedProducts = JSON.parse(productsData.products);
              productsArray = Array.isArray(parsedProducts)
                ? parsedProducts
                : [];
            } catch {
              productsArray = [];
            }
          }
          return {
            ...baseMessage,
            content: textContent,
            messageType: "products",
            products: productsArray,
          };
        } else if (
          type === "meal_plan_updated" ||
          type === "meal_plan_update"
        ) {
          const mealPlanPayload = payloadData as MealPlanPayload & {
            id?: string;
          };
          return {
            ...baseMessage,
            content:
              mealPlanPayload.title ||
              mealPlanPayload.description ||
              "Meal plan updated",
            messageType: "system",
            system: {
              kind: "meal_plan_updated",
              payload: {
                id: mealPlanPayload.id,
                action_type: mealPlanPayload.action_type,
                title: mealPlanPayload.title,
                description: mealPlanPayload.description,
                icons_details: mealPlanPayload.icons_details,
                redirection_details: mealPlanPayload.redirection_details,
              } as SystemMessageData["payload"] & {
                action_type?: string;
                description?: string;
                icons_details?: MealPlanIconsDetails;
                redirection_details?: MealPlanRedirectionDetail[];
              },
            },
          };
        } else if (
          type === "new_nutritionist" ||
          type === "new_nutrionist" ||
          type === "coach_assigned" ||
          type === "coach_details"
        ) {
          const nutritionistData = payloadData as {
            id?: string;
            name?: string;
            title?: string;
            profilePhoto?: string;
            description?: string;
            icons_details?: MealPlanIconsDetails;
            action_type?: string;
            redirection_details?: MealPlanRedirectionDetail[];
          };
          // Extract data from payload structure for coach_assigned/coach_details
          const name = nutritionistData.name || nutritionistData.title || "";
          const title =
            nutritionistData.title || nutritionistData.description || "";

          // Clean up icons_details - replace "image_url" placeholder with empty string
          let cleanedIconsDetails = nutritionistData.icons_details;
          if (cleanedIconsDetails && typeof cleanedIconsDetails === "object") {
            cleanedIconsDetails = {
              left_icon:
                cleanedIconsDetails.left_icon === "image_url"
                  ? ""
                  : cleanedIconsDetails.left_icon || "",
              right_icon:
                cleanedIconsDetails.right_icon === "image_url"
                  ? ""
                  : cleanedIconsDetails.right_icon || "",
            };
          }

          const profilePhotoRaw =
            nutritionistData.profilePhoto ||
            nutritionistData.icons_details?.left_icon ||
            "";
          // Clean up profilePhoto - replace "image_url" placeholder with empty string
          const profilePhoto =
            profilePhotoRaw === "image_url" ? "" : profilePhotoRaw;

          return {
            ...baseMessage,
            content: name || title || "New nutritionist assigned",
            messageType: "system",
            system: {
              kind: "new_nutritionist",
              id: nutritionistData.id || "",
              name: name,
              title: title,
              profilePhoto: profilePhoto,
              payload: {
                action_type:
                  nutritionistData.action_type ||
                  (type === "coach_assigned"
                    ? "coach_assigned"
                    : type === "coach_details"
                    ? "coach_details"
                    : undefined),
                title: nutritionistData.title || title,
                description: nutritionistData.description || "",
                icons_details: cleanedIconsDetails,
                redirection_details: nutritionistData.redirection_details,
              },
            },
          };
        } else if (
          type === "general_notification" ||
          type === "general-notification"
        ) {
          const notificationPayload = payloadData as {
            action_type?: string;
            title?: string;
            description?: string;
            redirection_details?: MealPlanRedirectionDetail[] | string;
          };

          // Parse redirection_details if it's a string
          let redirectionDetails: MealPlanRedirectionDetail[] | undefined;
          if (notificationPayload.redirection_details) {
            if (typeof notificationPayload.redirection_details === "string") {
              try {
                redirectionDetails = JSON.parse(
                  notificationPayload.redirection_details
                );
              } catch {
                redirectionDetails = undefined;
              }
            } else if (Array.isArray(notificationPayload.redirection_details)) {
              redirectionDetails = notificationPayload.redirection_details;
            }
          }

          return {
            ...baseMessage,
            content:
              notificationPayload.title ||
              notificationPayload.description ||
              "Notification",
            messageType: "general_notification",
            system: {
              kind: "general_notification",
              payload: {
                action_type: notificationPayload.action_type,
                title: notificationPayload.title,
                description: notificationPayload.description,
                redirection_details: redirectionDetails,
              } as SystemMessageData["payload"] & {
                action_type?: string;
                description?: string;
                redirection_details?: MealPlanRedirectionDetail[];
              },
            },
          };
        } else if (
          type === "video_call" ||
          type === "video-call" ||
          type === "voice_call" ||
          type === "voice-call"
        ) {
          const callPayload = payloadData as {
            title?: string;
            description?: string;
            icons_details?: MealPlanIconsDetails;
            call_details?: {
              call_url?: string;
            };
            redirection_details?: MealPlanRedirectionDetail[];
          };

          return {
            ...baseMessage,
            content:
              callPayload.title ||
              callPayload.description ||
              (type === "video_call" || type === "video-call"
                ? "Video call"
                : "Voice call"),
            messageType:
              type === "video_call" || type === "video-call"
                ? "video_call"
                : "voice_call",
            system: {
              kind:
                type === "video_call" || type === "video-call"
                  ? "video_call"
                  : "voice_call",
              payload: {
                title: callPayload.title,
                description: callPayload.description,
                icons_details: callPayload.icons_details,
                call_details: callPayload.call_details,
                redirection_details: callPayload.redirection_details,
              } as SystemMessageData["payload"] & {
                title?: string;
                description?: string;
                icons_details?: MealPlanIconsDetails;
                call_details?: {
                  call_url?: string;
                };
                redirection_details?: MealPlanRedirectionDetail[];
              },
            },
          };
        } else if (type === "documents") {
          const documentsPayload = payloadData as {
            title?: string;
            description?: string;
            icons_details?: MealPlanIconsDetails;
            documents_details?: {
              document_url?: string;
              document_size?: number;
              document_type?: string;
            };
            redirection_details?: MealPlanRedirectionDetail[];
          };

          return {
            ...baseMessage,
            content:
              documentsPayload.title ||
              documentsPayload.description ||
              "Document",
            messageType: "documents",
            system: {
              kind: "documents",
              payload: {
                title: documentsPayload.title,
                description: documentsPayload.description,
                icons_details: documentsPayload.icons_details,
                documents_details: documentsPayload.documents_details,
                redirection_details: documentsPayload.redirection_details,
              } as SystemMessageData["payload"] & {
                title?: string;
                description?: string;
                icons_details?: MealPlanIconsDetails;
                documents_details?: {
                  document_url?: string;
                  document_size?: number;
                  document_type?: string;
                };
                redirection_details?: MealPlanRedirectionDetail[];
              },
            },
            // Also set file properties for compatibility with FPFileMessageView
            fileUrl: documentsPayload.documents_details?.document_url,
            fileName: documentsPayload.title,
            fileMime: documentsPayload.documents_details?.document_type,
            fileSizeBytes: documentsPayload.documents_details?.document_size,
          };
        }
      }
    }
  } catch {
    // Not JSON, treat as regular text
  }

  if (shouldSuppressMultiDeviceSessionChatPayload(textContent)) {
    return null;
  }

  // Regular text message
  return {
    ...baseMessage,
    content: textContent,
    messageType: "text",
  };
};

function apiMessageIsFromUser(msg: ApiMessage): boolean | undefined {
  if (msg.isFromUser !== undefined) return msg.isFromUser;
  if (msg.is_from_user !== undefined) return msg.is_from_user;
  return undefined;
}

// Helper function to convert API message format to formatMessage format
export const convertApiMessageToFormat = (
  apiMsg: ApiMessage
): AgoraMessage | null => {
  // Convert API response message to format expected by formatMessage
  // The API may return message_id, conversation_id, from/to users, isFromUser, target_user_id, chat_group_id, body, timestamps, etc.
  // formatMessage expects: { id, from, to, time, type, msg, ... } plus backend fields for avatar / direction when present

  // Check if body has a type field to determine if it's a custom message
  let bodyObj: string | object | null | undefined = apiMsg.body;

  // Handle case where body is a string (parse it first)
  if (typeof bodyObj === "string") {
    try {
      bodyObj = JSON.parse(bodyObj);
    } catch {
      // Parse failed - bodyObj stays as string (plain text)
    }
  }

  // 🟢 FIX: Handle new format with messageType and payload: { messageType, payload }
  if (bodyObj && typeof bodyObj === "object") {
    const bodyObjTyped = bodyObj as {
      messageType?: string;
      payload?: object;
      data?: string;
      type?: string;
      products?: Product[] | string;
    };

    // Handle new format: { messageType, payload }
    if (bodyObjTyped.messageType && bodyObjTyped.payload) {
      // Extract payload and add messageType as type for compatibility
      bodyObj = {
        ...bodyObjTyped.payload,
        type: bodyObjTyped.messageType,
      };
    }
    // Handle nested payloads such as {"data":"{...}","type":"mealPlanUpdate"}
    else if (bodyObjTyped.data && typeof bodyObjTyped.data === "string") {
      try {
        const nested = JSON.parse(bodyObjTyped.data);
        if (nested && typeof nested === "object") {
          // Use the nested object, but preserve the outer type if nested doesn't have one
          bodyObj = {
            ...nested,
            type: (nested as { type?: string }).type || bodyObjTyped.type, // Prefer nested type, fallback to outer type
          };
        }
      } catch {
        // If parsing fails, keep bodyObj as is
      }
    }
  }

  // Filter out unwanted message types (healthCoachChanged, mealPlanUpdate)
  if (bodyObj && typeof bodyObj === "object") {
    const bodyObjTyped = bodyObj as { type?: string };
    if (bodyObjTyped.type) {
      const type = String(bodyObjTyped.type).toLowerCase();
      if (
        type === "healthcoachchanged" ||
        type === "mealplanupdate" ||
        type === "mealplanupdated" ||
        type === "healthCoachChanged" ||
        type === "mealPlanUpdate"
      ) {
        // Return null to filter out these messages - they should not appear on UI
        return null;
      }
    }
  }

  // 🟢 NORMALIZE products messages: Convert stringified products to array format
  // This ensures both formats (array and stringified) become the same before formatMessage
  if (bodyObj && typeof bodyObj === "object") {
    const bodyObjTyped = bodyObj as {
      type?: string;
      products?: Product[] | string;
    };
    if (
      (bodyObjTyped.type === "products" ||
        bodyObjTyped.type === "recommended_products") &&
      (bodyObjTyped.products ||
        (bodyObj as { product_list?: Product[] }).product_list)
    ) {
      // Handle product_list for recommended_products
      if (
        bodyObjTyped.type === "recommended_products" &&
        (bodyObj as { product_list?: Product[] }).product_list
      ) {
        (bodyObj as { products?: Product[] }).products = (
          bodyObj as { product_list: Product[] }
        ).product_list;
      } else if (typeof bodyObjTyped.products === "string") {
        try {
          const parsed = JSON.parse(bodyObjTyped.products);
          if (Array.isArray(parsed)) {
            (bodyObj as { products?: Product[] | string }).products = parsed; // Replace string with array
          }
        } catch {
          // If parsing fails, keep as is
        }
      }
    }
  }

  const bodyObjTyped =
    bodyObj && typeof bodyObj === "object"
      ? (bodyObj as { type?: string; message?: string })
      : null;
  const isTextMessage = bodyObjTyped && bodyObjTyped.type === "text";
  const isCustomMessage =
    bodyObjTyped && bodyObjTyped.type && bodyObjTyped.type !== "text";

  // Convert body object to string if it's an object
  let bodyContent: string;
  if (bodyObj && typeof bodyObj === "object") {
    // For text messages, extract just the message field
    if (isTextMessage && bodyObjTyped?.message !== undefined) {
      bodyContent = String(bodyObjTyped.message);
    } else {
      // For custom messages, stringify the entire object
      bodyContent = JSON.stringify(bodyObj);
    }
  } else if (bodyObj === null || bodyObj === undefined) {
    bodyContent = "";
  } else {
    bodyContent = String(bodyObj);
  }

  const apiMessageId =
    apiMsg.message_id || `api-${Date.now()}-${Math.random()}`;

  return {
    id: apiMessageId,
    from: String(apiMsg.from_user || ""),
    to: String(apiMsg.to_user || ""),
    time:
      apiMsg.created_at_ms ||
      new Date(apiMsg.created_at || Date.now()).getTime(),
    // Determine type: if body has a type field and it's not "text", treat as custom
    type: isCustomMessage ? "custom" : "txt",
    msg: bodyContent,
    msgContent: bodyContent,
    data: bodyContent,
    // Include backend API fields for formatMessage to detect backend format
    body: bodyContent,
    chat_type: apiMsg.chat_type,
    conversation_id: apiMsg.conversation_id,
    message_id: apiMsg.message_id,
    from_user: apiMsg.from_user,
    to_user: apiMsg.to_user,
    sender_name: apiMsg.sender_name,
    sender_photo: apiMsg.sender_photo,
    message_type: apiMsg.message_type,
    created_at: apiMsg.created_at,
    created_at_ms: apiMsg.created_at_ms,
    isFromUser: apiMessageIsFromUser(apiMsg),
    target_user_id: apiMsg.target_user_id,
    chat_group_id: apiMsg.chat_group_id,
    // For custom messages, also include the body object in ext.data so extractCustomMessageData can find it
    ...(isCustomMessage && bodyObj ? { ext: { data: bodyObj } } : {}),
  };
};
