import React, { useState, useEffect, useRef, useMemo } from "react";
import axios from "axios";
import config from "../../common/config.ts";
import FPChatHeader from "./FPChatHeader";
import FPChatTab from "./FPChatTab";
import type { Connection } from "agora-chat";
import FPMessageInput from "./FPMessageInput";
import FPDraftAttachmentPreview from "./FPDraftAttachmentPreview";
import FPMediaPopup from "./FPMediaPopup";
import FPAudioRecordingOverlay from "./FPAudioRecordingOverlay";
import FPCameraCaptureOverlay from "./FPCameraCaptureOverlay";
import FPImageViewer from "./FPImageViewer";
import FPVideoPlayer from "./FPVideoPlayer";
import FPAudioPlayer from "./FPAudioPlayer";
import FPScheduleCallModal from "./FPScheduleCallModal";
import FPProfileModal from "./FPProfileModal";
import FPScheduledCallBanner from "./FPScheduledCallBanner";
import {
  formatMessage,
  convertApiMessageToFormat,
  parseSystemPayload,
  getSystemLabel,
} from "../utils/messageFormatters.ts";
import { cancelCallWithDietitian } from "../services/dietitianApi";
import { sendCustomMessage, type ApiMessage } from "../services/chatApi";

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
  [key: string]: unknown;
}

import type {
  Message,
  Contact,
  DraftAttachment,
  CoachInfo,
  LogEntry,
  SystemMessageData,
} from "../../common/types/chat";

interface FPChatInterfaceProps {
  userId: string;
  /** Dietitian id (same as FPChatApp `conversationId`). */
  dietitianId: string;
  peerId: string | null;
  /** Agora group id — used as targetId for group history (getHistoryMessages). */
  groupId: string | null;
  setPeerId: (id: string | null) => void;
  message: string;
  setMessage: (msg: string | ((prev: string) => string)) => void;
  onSend: (msg: string | object) => void;
  onLogout?: () => void;
  logs: (string | LogEntry)[];
  selectedContact: Contact | null;
  chatClient: unknown;
  onBackToConversations?: (() => void) | null;
  onInitiateCall?: ((callType: "video" | "audio") => void) | null;
  onScheduleClick?: (() => void) | null;
  onSchedule?:
    | ((
        date: Date,
        time: string,
        topic: string,
        callType: "video" | "audio"
      ) => void)
    | null;
  onUpdateLastMessageFromHistory?: (peerId: string, message: Message) => void;
  onMessagesLoadedFromHistory?: (messageIds: string[]) => void;
  coachInfo?: CoachInfo;
  scheduledCallFromApi?: {
    date: string;
    start_time: string;
    call_date_time: number;
    schedule_call_id: number;
    call_type?: "video" | "audio";
  } | null;
  onRefreshScheduledCall?: () => Promise<void>;
}

export default function FPChatInterface({
  userId,
  dietitianId,
  peerId,
  groupId,
  setPeerId: _setPeerId,
  message,
  setMessage,
  onSend,
  onLogout: _onLogout,
  logs,
  selectedContact,
  chatClient,
  onBackToConversations,
  onInitiateCall,
  onScheduleClick: _onScheduleClick,
  onSchedule,
  onUpdateLastMessageFromHistory,
  onMessagesLoadedFromHistory,
  coachInfo = { coachName: "", profilePhoto: "" },
  scheduledCallFromApi,
  onRefreshScheduledCall,
}: FPChatInterfaceProps): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([]);
  const [showMediaPopup, setShowMediaPopup] = useState<boolean>(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [_selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [showCameraCapture, setShowCameraCapture] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<
    "user" | "environment"
  >("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);
  const [cursor, setCursor] = useState<string | number | null>(null);
  const [isFetchingHistory, setIsFetchingHistory] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [imageViewerUrl, setImageViewerUrl] = useState<string>("");
  const [imageViewerAlt, setImageViewerAlt] = useState<string>("");
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string>("");
  const [audioPlayerUrl, setAudioPlayerUrl] = useState<string>("");
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const mediaPopupRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingStreamForViz, setRecordingStreamForViz] =
    useState<MediaStream | null>(null);
  const [isRecordingStopped, setIsRecordingStopped] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [stoppedRecordingDuration, setStoppedRecordingDuration] =
    useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null); // Track when recording started
  const recordingDurationRef = useRef<number>(0); // Track duration in a ref for accurate reading
  const shouldSendRecordingRef = useRef<boolean>(true);
  const stoppedAudioBlobRef = useRef<Blob | null>(null);
  const [inputResetKey, setInputResetKey] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevMessageRef = useRef<string>("");
  const currentlyPlayingAudioRef = useRef<HTMLAudioElement | null>(null);
  const chatClientRef = useRef<unknown>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const audioBtnRef = useRef<HTMLButtonElement>(null);
  const fetchedPeersRef = useRef<{
    fetchedPeers: Set<string>;
    currentPeer: string | null;
  }>({
    fetchedPeers: new Set(), // Track which peers we've already fetched history for
    currentPeer: null, // Track the current peer to detect changes
  });
  /** Next Agora history cursor; null when no more Agora pages or not yet loaded. */
  const agoraHistoryCursorRef = useRef<string | null>(null);
  /** True after Agora returns no more history (empty page, no cursor, or isLast). */
  const agoraHistoryExhaustedRef = useRef<boolean>(false);
  /** Minimum Agora `time` (ms) seen for this peer — sent as DB `from` when Agora is done. */
  const minAgoraTimeMsRef = useRef<number | undefined>(undefined);
  const isLoadingHistoryRef = useRef<boolean>(false);
  const skipAutoScrollRef = useRef<boolean>(false);
  /** Tracks last scrolled-to "newest" message so prepending history does not jump the viewport. */
  const latestTailKeyRef = useRef<string | null>(null);

  // Handle mobile virtual keyboard - keep header and input visible
  useEffect(() => {
    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    const adjustLayoutForKeyboard = () => {
      const chatArea = chatAreaRef.current;
      const inputArea = document.querySelector(
        ".message-input-area"
      ) as HTMLElement;

      // Header height + tabs height
      const headerHeight = 110;
      // Input area height
      const inputHeight = 70;

      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const viewportOffsetTop = window.visualViewport.offsetTop || 0;
        const keyboardHeight =
          window.innerHeight - viewportHeight - viewportOffsetTop;

        // Only adjust if keyboard is likely open (significant height difference)
        if (keyboardHeight > 100) {
          // Calculate available height for chat area
          const availableHeight = viewportHeight - headerHeight - inputHeight;

          if (chatArea) {
            chatArea.style.position = "fixed";
            chatArea.style.top = `${headerHeight}px`;
            chatArea.style.bottom = "auto";
            chatArea.style.height = `${Math.max(availableHeight, 150)}px`;
            chatArea.style.overflow = "auto";
          }

          if (inputArea) {
            // On iOS, position input at the visual viewport bottom
            if (isIOS) {
              inputArea.style.position = "fixed";
              inputArea.style.bottom = "auto";
              inputArea.style.top = `${
                viewportHeight + viewportOffsetTop - inputHeight
              }px`;
            } else {
              inputArea.style.position = "fixed";
              inputArea.style.bottom = `${keyboardHeight}px`;
              inputArea.style.top = "auto";
            }
          }
        } else {
          // Keyboard is closed - reset to normal
          resetLayout();
        }
      }
    };

    const resetLayout = () => {
      const chatArea = chatAreaRef.current;
      const inputArea = document.querySelector(
        ".message-input-area"
      ) as HTMLElement;

      if (chatArea) {
        chatArea.style.position = "";
        chatArea.style.top = "";
        chatArea.style.bottom = "";
        chatArea.style.height = "";
        chatArea.style.overflow = "";
      }

      if (inputArea) {
        inputArea.style.position = "";
        inputArea.style.bottom = "";
        inputArea.style.top = "";
      }
    };

    // Prevent body scroll - only allow scroll in chat area
    const preventBodyScroll = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const chatArea = chatAreaRef.current;

      // Allow scrolling only if touch is within chat area
      if (chatArea && chatArea.contains(target)) {
        return; // Allow scroll in chat area
      }

      // Prevent scroll everywhere else
      e.preventDefault();
    };

    // Add touch event listener to prevent body scroll
    document.body.addEventListener("touchmove", preventBodyScroll, {
      passive: false,
    });

    // Listen for visual viewport changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", adjustLayoutForKeyboard);
      window.visualViewport.addEventListener("scroll", adjustLayoutForKeyboard);
    }

    // For iOS, also listen for focus events as fallback
    const handleFocus = () => {
      if (isIOS) {
        setTimeout(adjustLayoutForKeyboard, 300);
      }
    };

    const handleBlur = () => {
      if (isIOS) {
        setTimeout(resetLayout, 100);
      }
    };

    document.addEventListener("focusin", handleFocus);
    document.addEventListener("focusout", handleBlur);

    return () => {
      document.body.removeEventListener("touchmove", preventBodyScroll);
      document.removeEventListener("focusin", handleFocus);
      document.removeEventListener("focusout", handleBlur);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener(
          "resize",
          adjustLayoutForKeyboard
        );
        window.visualViewport.removeEventListener(
          "scroll",
          adjustLayoutForKeyboard
        );
      }
      resetLayout();
    };
  }, []);

  const toggleEmojiPicker = (): void => {
    setShowEmojiPicker((prev) => !prev);
  };

  // Helper: label for day headers (Today / Yesterday / formatted date)
  const formatDateLabel = (date: Date): string => {
    const now = new Date();
    const startOfDay = (d: Date): Date =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.floor(
      (startOfDay(now).getTime() - startOfDay(date).getTime()) / dayMs
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  // Currency formatter (INR by default to match the sample UI)
  const formatCurrency = (
    value: number | null | undefined,
    currency = "INR",
    locale = "en-IN"
  ): string => {
    if (value == null || isNaN(value)) return "";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      const prefix = currency === "INR" ? "₹" : "";
      return `${prefix}${Math.round(Number(value))}`;
    }
  };

  // Detect draft attachment from the current input message (JSON with type and url)
  // Note: audio messages are not shown as draft attachments, they are sent immediately
  const parseDraftAttachment = (
    raw: string | null | undefined
  ): DraftAttachment | null => {
    if (!raw || typeof raw !== "string" || raw.trim() === "") return null;
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || !obj.type) return null;
      const t = String(obj.type).toLowerCase();
      // Show draft for image, file, and audio
      if ((t === "image" || t === "file" || t === "audio") && obj.url) {
        return {
          type: t as "image" | "file" | "audio",
          url: obj.url,
          fileName: obj.fileName || "attachment",
          mimeType:
            obj.mimeType ||
            (t === "image"
              ? "image/*"
              : t === "audio"
              ? "audio/*"
              : "application/octet-stream"),
          size: obj.size ?? undefined,
          duration: obj.duration ?? undefined,
          // Include duration for audio
        };
      }
    } catch {}
    return null;
  };

  const draftAttachment = parseDraftAttachment(message);

  const clearDraftAttachment = (): void => {
    try {
      const att = parseDraftAttachment(message);
      if (att && typeof att.url === "string" && att.url.startsWith("blob:")) {
        URL.revokeObjectURL(att.url);
      }
    } catch {}
    setSelectedMedia(null);
    setMessage("");
  };

  const getDraftCaption = (): string => {
    if (!draftAttachment) return "";
    // For audio, don't show caption in input - the preview handles it
    if (draftAttachment.type === "audio") {
      return "";
    }
    try {
      const obj = JSON.parse(message);
      return obj.caption || obj.body || "";
    } catch {
      return "";
    }
  };

  useEffect(() => {
    const chatArea = chatAreaRef.current;
    if (!chatArea) return;

    const handleScroll = () => {
      if (chatArea.scrollTop === 0 && !isFetchingHistory && hasMore) {
        fetchMoreMessages();
      }
    };

    chatArea.addEventListener("scroll", handleScroll);
    return () => chatArea.removeEventListener("scroll", handleScroll);
  }, [peerId, isFetchingHistory, hasMore, cursor]);

  // Auto-scroll to bottom after layout (new content may change scrollHeight)
  const scrollToBottom = (): void => {
    requestAnimationFrame(() => {
      const el = chatAreaRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    });
  };

  // Convert logs to message format
  useEffect(() => {
    if (!peerId) {
      setMessages([]);
      return;
    }

    // Create a simple hash function for log content
    const hashLog = (log: string): number => {
      let hash = 0;
      for (let i = 0; i < log.length; i++) {
        const char = log.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    // Find the index of each log entry and create a unique identifier
    // Handle both old format (string) and new format (object with log and timestamp)
    const logEntries = logs.map((logEntry, logIndex) => {
      // Check for both 'log' and 'message' properties (message is used for edited messages)
      const log =
        typeof logEntry === "string"
          ? logEntry
          : logEntry.log || logEntry.message;
      // For log entries that are strings, we can't determine the actual timestamp
      // They will be replaced by server messages when history is fetched
      // For now, use current time but this will be corrected when messages are fetched from server
      const timestamp =
        typeof logEntry === "string"
          ? new Date() // Will be replaced by server timestamp when history is fetched
          : logEntry.timestamp || new Date();
      // Extract serverMsgId, mid, and isEdited from log entry if available (for message editing)
      const serverMsgId =
        typeof logEntry === "object" && "serverMsgId" in logEntry
          ? logEntry.serverMsgId
          : undefined;
      const mid =
        typeof logEntry === "object" && "mid" in logEntry
          ? logEntry.mid
          : undefined;
      const isEdited =
        typeof logEntry === "object" && "isEdited" in logEntry
          ? logEntry.isEdited
          : false;
      return {
        log,
        timestamp,
        logIndex,
        logHash: log ? hashLog(log) : 0, // Create hash of entire log for stable ID
        serverMsgId, // Include serverMsgId in the log entry data
        mid, // Include mid in the log entry data
        isEdited, // Include isEdited flag in the log entry data
      };
    });

    const sameChatUser = (a: string, b: string): boolean => {
      if (a === b) return true;
      const na = a.replace(/^user_/, "");
      const nb = b.replace(/^user_/, "");
      return na === nb;
    };

    const isGroupThread = Boolean(groupId && peerId === groupId);

    const filteredLogs = logEntries.filter((entry) => {
      const { log } = entry;
      if (!log) return false;
      // Filter messages for the current conversation
      if (log.includes("→")) {
        // Outgoing message: "You → peerId: message"
        const match = log.match(/You → ([^:]+):/);
        return match && match[1].trim() === peerId;
      }
      // Incoming: handlers use "senderId: content" (space after colon). Avoid split(":") — JSON bodies contain colons.
      const incomingSep = ": ";
      const sepIdx = log.indexOf(incomingSep);
      if (sepIdx > 0) {
        const senderId = log.slice(0, sepIdx).trim();
        if (!senderId) return false;
        // 1:1 chat: peer id is the other user
        if (senderId === peerId || sameChatUser(senderId, peerId)) {
          return true;
        }
        // Group chat: peerId is the group id, but Agora sets msg.from to the member's user id — strict equality never matches.
        if (
          isGroupThread &&
          !sameChatUser(senderId, userId) &&
          !senderId.includes(" ")
        ) {
          // Skip obvious system lines that still look like "Word: detail"
          if (/^(Error|Warning)$/i.test(senderId)) return false;
          return true;
        }
      }
      return false;
    });

    const newMessages = filteredLogs
      .map((entry) => {
        const {
          log,
          logHash,
          logIndex,
          timestamp,
          serverMsgId,
          mid,
          isEdited: logIsEdited,
        } = entry;

        if (!log) return null;
        const isOutgoing = log.includes("→");
        const messageTime =
          timestamp instanceof Date ? timestamp : new Date(timestamp);
        // Create a unique timestamp to ensure consecutive duplicate messages have different IDs
        // Use logHash + logIndex for stable IDs that don't change across re-renders
        // This ensures the same log entry always gets the same ID
        const uniqueTimestamp = logHash + logIndex;

        if (isOutgoing) {
          // Parse "You → peerId: message"
          // Updated regex to handle JSON strings that may contain colons
          const match = log.match(/You → [^:]+: (.+)$/);
          let content = match ? match[1].trim() : "";

          // If content looks like JSON (starts with {), try to parse it
          if (content.startsWith("{")) {
            // Content is already the JSON string, use it as-is
          } else {
            // Fallback: try to extract everything after the first colon
            const colonIndex = log.indexOf(": ");
            if (colonIndex !== -1) {
              content = log.substring(colonIndex + 2).trim();
            }
          }

          // Parse special message formats (IMAGE_DATA, FILE_DATA, or backend JSON)
          let messageContent = content;
          let messageType = "text";
          let imageData = null;
          let fileName = null;
          let fileSize = null;
          let imageUrl = null;
          let audioUrl = null;
          let audioDurationMs = null;
          let audioTranscription = null;
          let fileUrl = null;
          let fileMime = null;
          let fileSizeBytes = null;
          let products = null;
          let callType: string | undefined = undefined;
          let callDurationSeconds: number | undefined = undefined;
          let callChannel: string | undefined = undefined;
          let system = null;

          if (content.startsWith("IMAGE_DATA:")) {
            const imageParts = content.split(":");
            if (imageParts.length >= 3) {
              imageData = imageParts[1];
              fileName = imageParts.slice(2).join(":");
              messageType = "image";
              messageContent = fileName;
            }
          } else if (content.startsWith("FILE_DATA:")) {
            const fileParts = content.split(":");
            if (fileParts.length >= 4) {
              imageData = fileParts[1];
              fileName = fileParts[2];
              fileSize = fileParts[3];
              messageType = "file";
              messageContent = `📎 ${fileName} (${fileSize} KB)`;
            }
          } else {
            // Try backend JSON payloads → else system → else text
            try {
              const obj = JSON.parse(content);

              if (obj && typeof obj === "object" && obj.type) {
                const t = String(obj.type).toLowerCase();
                // skip system messages coming from logs to avoid duplicates
                // ---- IGNORE HEALTH COACH CHANGED MESSAGES ----
                if (t === "mealPlanUpdate" || t === "healthCoachChanged") {
                  return null; // <-- This ensures UI never displays it
                }

                switch (t) {
                  case "text":
                    messageType = "text";
                    messageContent = obj.body ?? "";
                    break;
                  case "image":
                    messageType = "image";
                    imageUrl = obj.url ?? null;
                    messageContent = obj.url ?? "Image";
                    fileName = obj.fileName ?? null;
                    break;
                  case "audio":
                    messageType = "audio";
                    audioUrl = obj.url ?? null;
                    audioDurationMs = obj.duration ?? null;
                    audioTranscription = obj.transcription ?? null;
                    messageContent = "Audio message";
                    break;
                  case "file":
                    messageType = "file";
                    fileUrl = obj.url ?? null;
                    fileMime = obj.mimeType ?? null;
                    fileSizeBytes = obj.size ?? null;
                    try {
                      const urlObj = new URL(obj.url);
                      fileName = decodeURIComponent(
                        urlObj.pathname.split("/").pop() || "file"
                      );
                    } catch {
                      fileName = obj.fileName || obj.url || "file";
                    }
                    messageContent = `📎 ${fileName}`;
                    break;
                  case "products":
                  case "recommended_products":
                    messageType = "products";
                    // Handle both 'products' and 'product_list' fields
                    if (Array.isArray(obj.products)) {
                      products = obj.products;
                    } else if (Array.isArray(obj.product_list)) {
                      products = obj.product_list;
                    } else {
                      products = [];
                    }
                    messageContent = "Products";
                    break;
                  case "new_nutritionist":
                  case "new_nutrionist":
                  case "coach_assigned":
                  case "coach_details":
                    messageType = "system";
                    // Extract data from payload structure for coach_assigned/coach_details
                    // Use the values directly from obj to preserve what was sent
                    const name = obj.name || obj.title || "";
                    const extractedTitle = obj.title || obj.description || "";
                    const profilePhoto =
                      obj.profilePhoto || obj.icons_details?.left_icon || "";

                    // Determine action_type - prioritize obj.action_type, then obj.type
                    const actionType =
                      obj.action_type ||
                      (obj.type === "coach_assigned"
                        ? "coach_assigned"
                        : obj.type === "coach_details"
                        ? "coach_details"
                        : undefined);

                    // Clean up icons_details - replace "image_url" placeholder with empty string
                    let cleanedIconsDetails = obj.icons_details;
                    if (
                      cleanedIconsDetails &&
                      typeof cleanedIconsDetails === "object"
                    ) {
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

                    // Clean up profilePhoto - replace "image_url" placeholder with empty string
                    const cleanedProfilePhoto =
                      profilePhoto === "image_url" ? "" : profilePhoto;

                    system = {
                      kind: "new_nutritionist",
                      id: obj.id || "",
                      name: name,
                      title: extractedTitle,
                      profilePhoto: cleanedProfilePhoto,
                      payload: {
                        // Always include action_type
                        action_type: actionType,
                        // Preserve title from obj (can be empty string for coach_assigned)
                        title:
                          obj.title !== undefined ? obj.title : extractedTitle,
                        // Preserve description from obj (can be empty string for coach_assigned)
                        description:
                          obj.description !== undefined ? obj.description : "",
                        // Use cleaned icons_details (replace "image_url" with empty string)
                        icons_details: cleanedIconsDetails || undefined,
                        // Preserve redirection_details array
                        redirection_details:
                          obj.redirection_details || undefined,
                      },
                    };

                    messageContent =
                      name || extractedTitle || "New nutritionist assigned";
                    break;
                  case "meal_plan_updated":
                  case "meal_plan_update":
                    messageType = "system";
                    system = {
                      kind: "meal_plan_updated",
                      payload: {
                        action_type: obj.action_type,
                        title: obj.title,
                        description: obj.description,
                        icons_details: obj.icons_details,
                        redirection_details: obj.redirection_details,
                      },
                    };
                    messageContent = obj.title || "Meal plan updated";
                    break;
                  case "general_notification":
                  case "general-notification":
                    messageType = "general_notification";
                    system = {
                      kind: "general_notification",
                      payload: {
                        action_type: obj.action_type,
                        title: obj.title,
                        description: obj.description,
                        redirection_details: obj.redirection_details,
                      },
                    };
                    messageContent =
                      obj.title || obj.description || "Notification";
                    break;
                  case "video_call":
                  case "voice_call":
                    messageType =
                      obj.type === "video_call" ? "video_call" : "voice_call";
                    system = {
                      kind:
                        obj.type === "video_call" ? "video_call" : "voice_call",
                      payload: {
                        title: obj.title,
                        description: obj.description,
                        icons_details: obj.icons_details,
                        call_details: obj.call_details,
                        redirection_details: obj.redirection_details,
                      },
                    };
                    messageContent =
                      obj.title ||
                      obj.description ||
                      (obj.type === "video_call" ? "Video call" : "Voice call");
                    break;
                  case "documents":
                    messageType = "documents";
                    system = {
                      kind: "documents",
                      payload: {
                        title: obj.title,
                        description: obj.description,
                        icons_details: obj.icons_details,
                        documents_details: obj.documents_details,
                        redirection_details: obj.redirection_details,
                      },
                    };
                    messageContent = obj.title || obj.description || "Document";
                    // Also set file properties for compatibility with FPFileMessageView
                    fileUrl = obj.documents_details?.document_url || null;
                    fileName = obj.title || null;
                    fileMime = obj.documents_details?.document_type || null;
                    fileSizeBytes =
                      obj.documents_details?.document_size || null;
                    break;
                  case "call":
                    // Convert old "call" format to new format
                    const oldCallType = obj.callType as
                      | "video"
                      | "audio"
                      | undefined;
                    messageType =
                      oldCallType === "audio" ? "voice_call" : "video_call";
                    const callTitle =
                      oldCallType === "video" ? "Video call" : "Voice call";
                    let callDescription: string | undefined;
                    if (obj.duration != null) {
                      const minutes = Math.floor(obj.duration / 60);
                      const seconds = obj.duration % 60;
                      callDescription = `${minutes}:${String(seconds).padStart(
                        2,
                        "0"
                      )}`;
                    }
                    system = {
                      kind:
                        oldCallType === "audio" ? "voice_call" : "video_call",
                      payload: {
                        title: callTitle,
                        description: callDescription,
                        call_details: obj.channel
                          ? { call_url: obj.channel }
                          : undefined,
                      },
                    };
                    messageContent = callDescription
                      ? `${callTitle} - ${callDescription}`
                      : callTitle;
                    break;
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      if (
                        parsed.kind === "new_nutritionist" &&
                        parsed.payload
                      ) {
                        // Extract nutritionist data from payload
                        system = {
                          kind: "new_nutritionist",
                          id: parsed.payload.id || "",
                          name: parsed.payload.name || "",
                          title: parsed.payload.title || "",
                          profilePhoto: parsed.payload.profilePhoto || "",
                        };
                      } else {
                        system = parsed;
                      }
                      messageType = "system";
                      const systemData: SystemMessageData = {
                        kind: parsed.kind,
                        ...parsed.payload,
                      };
                      messageContent = getSystemLabel(systemData);
                    }
                  }
                }
              }
            } catch {
              // not JSON -> keep as text
            }
          }

          // Filter out hidden call messages (only one user joined)
          if (messageType === "hidden") {
            return null;
          }

          // Use serverMsgId if available (from send response), otherwise generate local ID
          const messageId =
            serverMsgId ||
            `outgoing-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`;

          // Ensure products is always an array when messageType is products
          const finalProducts =
            messageType === "products"
              ? Array.isArray(products)
                ? products
                : []
              : products;

          return {
            id: messageId, // Use serverMsgId if available, otherwise use generated local ID
            serverMsgId: serverMsgId || undefined,
            sender: "You",
            content: messageContent,
            imageData: imageData ?? undefined,
            imageUrl,
            fileName,
            fileSize: fileSize ?? undefined,
            messageType,
            system: system ? (system as SystemMessageData) : undefined,
            audioUrl,
            audioDurationMs,
            audioTranscription,
            fileUrl,
            fileMime,
            fileSizeBytes,
            products: finalProducts,
            callType,
            callDurationSeconds,
            channel: callChannel,
            createdAt: messageTime,
            timestamp: messageTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isIncoming: false, // Outgoing message - right side
            avatar: coachInfo?.profilePhoto || config.defaults.userAvatar,
            peerId, // Store peerId for conversation tracking
          };
        } else {
          // Parse "senderId: message"
          const parts = log.split(":");
          const sender = parts[0].trim();
          const content = parts.slice(1).join(":").trim();

          // Parse special message formats (IMAGE_DATA, FILE_DATA) or backend JSON payloads
          let messageContent = content;
          let messageType = "text";
          let imageData = null;
          let fileName = null;
          let fileSize = null;
          let imageUrl = null;
          let audioUrl = null;
          let audioDurationMs = null;
          let audioTranscription = null;
          let fileUrl = null;
          let fileMime = null;
          let fileSizeBytes = null;
          let products = null;
          let callType: string | undefined = undefined;
          let callDurationSeconds: number | undefined = undefined;
          let callChannel: string | undefined = undefined;
          let system = null;

          if (content.startsWith("IMAGE_DATA:")) {
            const imageParts = content.split(":");
            if (imageParts.length >= 3) {
              imageData = imageParts[1];
              fileName = imageParts.slice(2).join(":");
              messageType = "image";
              messageContent = fileName;
            }
          } else if (content.startsWith("FILE_DATA:")) {
            const fileParts = content.split(":");
            if (fileParts.length >= 4) {
              imageData = fileParts[1];
              fileName = fileParts[2];
              fileSize = fileParts[3];
              messageType = "file";
              messageContent = `📎 ${fileName} (${fileSize} KB)`;
            }
          } else {
            // Try backend JSON payloads → else system → else text
            try {
              const obj = JSON.parse(content);

              if (obj && typeof obj === "object" && obj.type) {
                const t = String(obj.type).toLowerCase();
                // skip system messages coming from logs to avoid duplicates
                // ---- IGNORE HEALTH COACH CHANGED MESSAGES ----
                if (t === "mealPlanUpdate" || t === "healthCoachChanged") {
                  return null; // <-- This ensures UI never displays it
                }

                switch (t) {
                  case "text":
                    messageType = "text";
                    messageContent = obj.body ?? "";
                    break;
                  case "image":
                    messageType = "image";
                    imageUrl = obj.url ?? null;
                    messageContent = obj.url ?? "Image";
                    break;
                  case "audio":
                    messageType = "audio";
                    audioUrl = obj.url ?? null;
                    audioDurationMs = obj.duration ?? null;
                    audioTranscription = obj.transcription ?? null;
                    messageContent = "Audio message";
                    break;
                  case "file":
                    messageType = "file";
                    fileUrl = obj.url ?? null;
                    fileMime = obj.mimeType ?? null;
                    fileSizeBytes = obj.size ?? null;
                    try {
                      const urlObj = new URL(obj.url);
                      fileName = decodeURIComponent(
                        urlObj.pathname.split("/").pop() || "file"
                      );
                    } catch {
                      fileName = obj.url ?? "file";
                    }
                    messageContent = `📎 ${fileName}`;
                    break;
                  case "products":
                  case "recommended_products":
                    messageType = "products";
                    // Handle both 'products' and 'product_list' fields
                    if (Array.isArray(obj.products)) {
                      products = obj.products;
                    } else if (Array.isArray(obj.product_list)) {
                      products = obj.product_list;
                    } else {
                      products = [];
                    }
                    messageContent = "Products";
                    break;
                  case "general_notification":
                  case "general-notification":
                    messageType = "general_notification";
                    try {
                      const parsed = JSON.parse(content);
                      if (parsed && typeof parsed === "object") {
                        system = {
                          kind: "general_notification",
                          payload: {
                            action_type: parsed.action_type,
                            title: parsed.title,
                            description: parsed.description,
                            redirection_details: parsed.redirection_details,
                          },
                        };
                        messageContent =
                          parsed.title || parsed.description || "Notification";
                      }
                    } catch {
                      // If parsing fails, try parseSystemPayload
                      const parsed = parseSystemPayload(content);
                      if (parsed && parsed.kind === "general_notification") {
                        system = parsed;
                        messageContent =
                          parsed.payload?.title ||
                          parsed.payload?.description ||
                          "Notification";
                      }
                    }
                    break;
                  case "call":
                    // Convert old "call" format to new format
                    const oldCallType2 = obj.callType as
                      | "video"
                      | "audio"
                      | undefined;
                    messageType =
                      oldCallType2 === "audio" ? "voice_call" : "video_call";
                    const callTitle2 =
                      oldCallType2 === "video" ? "Video call" : "Voice call";
                    let callDescription2: string | undefined;
                    if (obj.duration != null) {
                      const minutes = Math.floor(obj.duration / 60);
                      const seconds = obj.duration % 60;
                      callDescription2 = `${minutes}:${String(seconds).padStart(
                        2,
                        "0"
                      )}`;
                    }
                    system = {
                      kind:
                        oldCallType2 === "audio" ? "voice_call" : "video_call",
                      payload: {
                        title: callTitle2,
                        description: callDescription2,
                        call_details: obj.channel
                          ? { call_url: obj.channel }
                          : undefined,
                      },
                    };
                    messageContent = callDescription2
                      ? `${callTitle2} - ${callDescription2}`
                      : callTitle2;
                    break;
                  case "video_call":
                  case "voice_call":
                    messageType =
                      obj.type === "video_call" ? "video_call" : "voice_call";
                    try {
                      const parsed = JSON.parse(content);
                      if (parsed && typeof parsed === "object") {
                        system = {
                          kind:
                            parsed.type === "video_call"
                              ? "video_call"
                              : "voice_call",
                          payload: {
                            title: parsed.title,
                            description: parsed.description,
                            icons_details: parsed.icons_details,
                            call_details: parsed.call_details,
                            redirection_details: parsed.redirection_details,
                          },
                        };
                        messageContent =
                          parsed.title ||
                          parsed.description ||
                          (parsed.type === "video_call"
                            ? "Video call"
                            : "Voice call");
                      }
                    } catch {
                      // If parsing fails, try parseSystemPayload
                      const parsed = parseSystemPayload(content);
                      if (
                        parsed &&
                        (parsed.kind === "video_call" ||
                          parsed.kind === "voice_call")
                      ) {
                        system = parsed;
                        messageContent =
                          parsed.payload?.title ||
                          parsed.payload?.description ||
                          (parsed.kind === "video_call"
                            ? "Video call"
                            : "Voice call");
                      }
                    }
                    break;
                  case "documents":
                    messageType = "documents";
                    try {
                      const parsed = JSON.parse(content);
                      if (parsed && typeof parsed === "object") {
                        system = {
                          kind: "documents",
                          payload: {
                            title: parsed.title,
                            description: parsed.description,
                            icons_details: parsed.icons_details,
                            documents_details: parsed.documents_details,
                            redirection_details: parsed.redirection_details,
                          },
                        };
                        messageContent =
                          parsed.title || parsed.description || "Document";
                        // Also set file properties for compatibility with FPFileMessageView
                        fileUrl =
                          parsed.documents_details?.document_url || null;
                        fileName = parsed.title || null;
                        fileMime =
                          parsed.documents_details?.document_type || null;
                        fileSizeBytes =
                          parsed.documents_details?.document_size || null;
                      }
                    } catch {
                      // If parsing fails, try parseSystemPayload
                      const parsed = parseSystemPayload(content);
                      if (parsed && parsed.kind === "documents") {
                        system = parsed;
                        messageContent =
                          parsed.payload?.title ||
                          parsed.payload?.description ||
                          "Document";
                        const documentsDetails = parsed.payload
                          ?.documents_details as
                          | {
                              document_url?: string;
                              document_size?: number;
                              document_type?: string;
                            }
                          | undefined;
                        fileUrl = documentsDetails?.document_url || null;
                        fileName = parsed.payload?.title || null;
                        fileMime = documentsDetails?.document_type || null;
                        fileSizeBytes = documentsDetails?.document_size || null;
                      }
                    }
                    break;
                  default: {
                    const parsed = parseSystemPayload(content);
                    if (parsed) {
                      if (parsed.kind === "general_notification") {
                        // Handle general_notification as a regular message type
                        messageType = "general_notification";
                        system = parsed;
                        messageContent =
                          parsed.payload?.title ||
                          parsed.payload?.description ||
                          "Notification";
                      } else if (
                        parsed.kind === "video_call" ||
                        parsed.kind === "voice_call"
                      ) {
                        // Handle video_call and voice_call as regular message types
                        messageType = parsed.kind;
                        system = parsed;
                        messageContent =
                          parsed.payload?.title ||
                          parsed.payload?.description ||
                          (parsed.kind === "video_call"
                            ? "Video call"
                            : "Voice call");
                      } else if (
                        parsed.kind === "new_nutritionist" &&
                        parsed.payload
                      ) {
                        // Extract nutritionist data from payload
                        // Handle both new_nutritionist format and coach_assigned/coach_details format
                        const payload = parsed.payload as {
                          id?: string;
                          name?: string;
                          title?: string;
                          profilePhoto?: string;
                          description?: string;
                          icons_details?: {
                            left_icon?: string;
                            right_icon?: string;
                          };
                          action_type?: string;
                        };
                        const name = payload.name || payload.title || "";
                        const title =
                          payload.title || payload.description || "";
                        const profilePhoto =
                          payload.profilePhoto ||
                          payload.icons_details?.left_icon ||
                          "";
                        system = {
                          kind: "new_nutritionist",
                          id: payload.id || "",
                          name: name,
                          title: title,
                          profilePhoto: profilePhoto,
                          payload: {
                            action_type: payload.action_type,
                            icons_details: payload.icons_details,
                          },
                        };
                        messageType = "system";
                        const systemData: SystemMessageData = {
                          kind: parsed.kind,
                          ...parsed.payload,
                        };
                        messageContent =
                          name || title || getSystemLabel(systemData);
                      } else {
                        system = parsed;
                        messageType = "system";
                        const systemData: SystemMessageData = {
                          kind: parsed.kind,
                          ...parsed.payload,
                        };
                        messageContent = getSystemLabel(systemData);
                      }
                    }
                  }
                }
              }
            } catch {
              // not JSON -> keep as text
            }
          }

          // Filter out hidden call messages (only one user joined)
          if (messageType === "hidden") {
            return null;
          }

          const generatedId = `incoming-${peerId}-${logHash}-${logIndex}-${uniqueTimestamp}`;

          // Ensure products is always an array when messageType is products
          const finalProducts =
            messageType === "products"
              ? Array.isArray(products)
                ? products
                : []
              : products;

          // Get mid, serverMsgId, and isEdited from log entry if available
          // These are already extracted from entry in the map function above
          const messageMid = mid || serverMsgId;
          const messageServerMsgId = serverMsgId;
          const messageIsEdited = logIsEdited || false;

          return {
            id: generatedId, // Include logIndex and timestamp to ensure unique IDs for consecutive duplicate messages
            sender,
            content: messageContent,
            imageData: imageData ?? undefined,
            imageUrl,
            fileName,
            fileSize: fileSize ?? undefined,
            messageType,
            system: system ? (system as SystemMessageData) : undefined,
            audioUrl,
            audioDurationMs,
            audioTranscription,
            fileUrl,
            fileMime,
            fileSizeBytes,
            products: finalProducts,
            callType,
            callDurationSeconds,
            channel: callChannel,
            createdAt: messageTime,
            timestamp: messageTime.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
            isIncoming: true, // Incoming message - left side
            avatar: selectedContact?.avatar || config.defaults.avatar,
            peerId, // Store peerId for conversation tracking
            mid: messageMid, // Message ID from delivery receipt (for editing)
            serverMsgId: messageServerMsgId, // Server message ID (for matching edited messages)
            isEdited: messageIsEdited, // Flag to indicate this is an edited message
          };
        }
      })
      .filter((msg) => msg !== null); // Filter out null messages (hidden call messages)

    // Only show messages for the current conversation (peerId)
    setMessages((prev) => {
      // If peerId changed, reset messages for the new conversation

      const currentPeerMessages = prev.filter((msg) => msg.peerId === peerId);

      // Create a set of existing message IDs to prevent duplicates
      const existingIds = new Set(currentPeerMessages.map((msg) => msg.id));

      // Create a map of existing messages by mid, serverMsgId, and id to detect edited messages
      const existingMessagesByMid = new Map<string, Message>();
      const existingMessagesByServerId = new Map<string, Message>();
      const existingMessagesById = new Map<string, Message>();
      currentPeerMessages.forEach((msg) => {
        if (msg.mid) {
          existingMessagesByMid.set(msg.mid, msg);
        }
        // Map by serverMsgId - this is the key for matching edited messages
        if (msg.serverMsgId) {
          existingMessagesByServerId.set(msg.serverMsgId, msg);
        }
        // Also map by id - edited messages might have the same id
        existingMessagesById.set(msg.id, msg);
        // Also map by the message's server ID if it's a server message (id doesn't start with outgoing-/incoming-)
        // This helps match edited messages that come with the same server ID
        if (
          !msg.id.startsWith("outgoing-") &&
          !msg.id.startsWith("incoming-")
        ) {
          existingMessagesByServerId.set(msg.id, msg);
        }
      });

      // Helper function to create matching key (same as in server fetch)
      const normalizeContent = (content: string | null | undefined): string => {
        if (!content) return "";
        try {
          const parsed = JSON.parse(content);
          return JSON.stringify(parsed);
        } catch {
          return String(content).trim();
        }
      };

      const createMatchKey = (msg: Message): string => {
        const normalizedContent = normalizeContent(msg.content);
        const createdAt = msg.createdAt ? new Date(msg.createdAt) : new Date();
        const timeWindow = Math.floor(createdAt.getTime() / 300000); // 5-minute window

        // For custom messages, include messageType and identifying fields in the key
        if (msg.messageType && msg.messageType !== "text") {
          let customKey = "";

          // Try to extract from message fields first
          if (msg.messageType === "image" && msg.imageUrl) {
            customKey = msg.imageUrl;
          } else if (msg.messageType === "audio" && msg.audioUrl) {
            customKey = msg.audioUrl;
          } else if (msg.messageType === "file" && msg.fileUrl) {
            customKey = msg.fileUrl;
          } else if (msg.messageType === "call") {
            // For call messages, use content-based matching (not ID) so log and server messages match
            // Extract action and duration from message object or content
            let callAction = msg.callAction || "";
            let callDuration =
              msg.callDurationSeconds != null
                ? String(msg.callDurationSeconds)
                : "";
            let callType = msg.callType || "video";
            let callChannel = msg.channel || "";

            // If fields not on message object, try to extract from content
            if (
              (!callAction || !callChannel) &&
              typeof msg.content === "string"
            ) {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (contentObj.action) callAction = contentObj.action;
                  if (contentObj.duration != null)
                    callDuration = String(contentObj.duration);
                  if (contentObj.callType) callType = contentObj.callType;
                  if (contentObj.channel) callChannel = contentObj.channel;
                }
              } catch {}
            }

            // Use content-based key with timestamp in 2-second window to match log/server messages
            // This allows log and server messages of the same call to match
            // But different calls (different durations or times > 2s apart) won't match
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 2000);
            customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
          } else if (msg.messageType === "products" && msg.products) {
            // For products, use timestamp-based matching to allow multiple sends
            // Extract first product action_id or title for uniqueness
            let productKey = "";
            if (Array.isArray(msg.products) && msg.products.length > 0) {
              productKey =
                msg.products[0]?.action_id || msg.products[0]?.title || "";
            }
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
            customKey = productKey
              ? `${productKey}-${timestampSeconds}`
              : `products-${timestampSeconds}`;
          }

          // If customKey is still empty, try to extract from content JSON
          if (!customKey && typeof msg.content === "string") {
            try {
              const contentObj = JSON.parse(msg.content);
              if (contentObj && typeof contentObj === "object") {
                if (msg.messageType === "image" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "audio" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "file" && contentObj.url) {
                  customKey = contentObj.url;
                } else if (msg.messageType === "call") {
                  // For call messages from content, use content-based matching
                  const callAction = contentObj.action || "";
                  const callDuration =
                    contentObj.duration != null
                      ? String(contentObj.duration)
                      : "";
                  const callType = contentObj.callType || "video";
                  const callChannel = contentObj.channel || "";
                  // Use content-based key with 2-second timestamp window
                  const createdAt = msg.createdAt
                    ? new Date(msg.createdAt)
                    : new Date();
                  const timestampSeconds = Math.floor(
                    createdAt.getTime() / 2000
                  );
                  customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                } else if (msg.messageType === "products") {
                  // Handle both array and stringified products formats
                  // Also handle 'product_list' for recommended_products
                  let productsArray = [];
                  if (Array.isArray(contentObj.products)) {
                    productsArray = contentObj.products;
                  } else if (Array.isArray(contentObj.product_list)) {
                    productsArray = contentObj.product_list;
                  } else if (typeof contentObj.products === "string") {
                    try {
                      const parsed = JSON.parse(contentObj.products);
                      productsArray = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      productsArray = [];
                    }
                  }
                  // Use timestamp-based matching to allow multiple sends
                  let productKey = "";
                  if (productsArray.length > 0) {
                    productKey =
                      productsArray[0]?.action_id ||
                      productsArray[0]?.title ||
                      "";
                  }
                  const createdAt = msg.createdAt
                    ? new Date(msg.createdAt)
                    : new Date();
                  const timestampSeconds = Math.floor(
                    createdAt.getTime() / 1000
                  );
                  customKey = productKey
                    ? `${productKey}-${timestampSeconds}`
                    : `products-${timestampSeconds}`;
                }
              }
            } catch {
              // Not JSON, ignore
            }
          }

          if (customKey) {
            // For call messages, don't use timeWindow since customKey already includes timestamp
            // Use only messageType, customKey, and sender
            if (
              msg.messageType === "call" ||
              msg.messageType === "video_call" ||
              msg.messageType === "voice_call"
            ) {
              // Use the new format type for matching
              const matchType =
                msg.messageType === "call"
                  ? msg.callType === "audio"
                    ? "voice_call"
                    : "video_call"
                  : msg.messageType;
              return `${matchType}-${customKey}-${msg.sender}`;
            }
            // For products messages, customKey already includes timestamp, so don't add timeWindow
            if (msg.messageType === "products") {
              return `${msg.messageType}-${customKey}-${msg.sender}`;
            }
            return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
          }

          // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
          if (msg.messageType === "system" && msg.system) {
            // Use a more granular timestamp (1-second window) to allow multiple system messages
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
            const systemKind = msg.system.kind || "";
            return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
          }

          // For new message types (general_notification, video_call, voice_call, documents)
          // Use timestamp-based matching to allow both sent and received versions
          if (
            msg.messageType === "general_notification" ||
            msg.messageType === "video_call" ||
            msg.messageType === "voice_call" ||
            msg.messageType === "documents"
          ) {
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
            // Include sender to differentiate between sent and received
            return `${msg.messageType}-${msg.sender}-${timestampSeconds}`;
          }
        }

        // For text messages: stable server id when present; else second bucket for log↔server merge
        if (msg.messageType === "text" || !msg.messageType) {
          if (msg.serverMsgId) {
            return `txt:${msg.serverMsgId}`;
          }
          if (msg.mid) {
            return `txt:${msg.mid}`;
          }
          // Send path stores Agora id on `id` without outgoing- prefix (see outgoing messageId)
          if (
            msg.id &&
            !msg.id.startsWith("outgoing-") &&
            !msg.id.startsWith("incoming-")
          ) {
            return `txt:${msg.id}`;
          }
          const createdAt = msg.createdAt
            ? new Date(msg.createdAt)
            : new Date();
          const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
          return `${normalizedContent}-${msg.sender}-${timestampSeconds}`;
        }

        // Fallback to content-based matching for other messages
        return `${normalizedContent}-${msg.sender}-${timeWindow}`;
      };

      // Create a map of existing messages by their match key
      const existingMessagesByKey = new Map();
      currentPeerMessages.forEach((msg) => {
        const key = createMatchKey(msg);
        if (!existingMessagesByKey.has(key)) {
          existingMessagesByKey.set(key, msg);
        }
      });

      // Process new messages: detect edited messages and update existing ones
      const processedNewMessages = newMessages.map((msg) => {
        // Check if this is an edited message by mid, serverMsgId, or id
        let existingMsg: Message | undefined;

        // First check by mid (preferred for edited messages)
        if (msg.mid) {
          existingMsg = existingMessagesByMid.get(msg.mid);
        }

        // If not found by mid, check by serverMsgId (this is the server message ID from Agora)
        if (!existingMsg && msg.serverMsgId) {
          existingMsg = existingMessagesByServerId.get(msg.serverMsgId);
        }

        // If not found, check by id (edited messages might have same id)
        // But only if the message is marked as edited
        if (!existingMsg && msg.id && msg.isEdited) {
          existingMsg = existingMessagesById.get(msg.id);
        }

        // If we found an existing message with the same mid/serverMsgId/id and this is marked as edited
        if (existingMsg && (msg.isEdited || msg.mid || msg.serverMsgId)) {
          // This is an edited message - mark it for update
          // IMPORTANT: Keep the new content from msg (the edited message)
          return {
            ...msg,
            id: existingMsg.id, // Keep the original generated ID
            mid: msg.mid || existingMsg.mid, // Preserve mid if available
            serverMsgId: msg.serverMsgId || existingMsg.serverMsgId, // Preserve serverMsgId
            isEdited: true, // Mark as edited
            // Content should already be in msg.content from the log parsing
          };
        }
        return msg;
      });

      // Filter out messages that match existing messages by content/key (not just ID)
      // This prevents duplicates when server messages already exist
      const uniqueNewMessages = processedNewMessages.filter((msg) => {
        // First check by ID (for exact duplicates)
        if (existingIds.has(msg.id)) {
          // If this is an edited message, we still want to process it
          if (msg.isEdited && (msg.mid || msg.serverMsgId)) {
            return true; // Allow edited messages to pass through
          }
          return false;
        }
        // Then check by content/key (to match with server messages that have different IDs)
        const key = createMatchKey(msg);
        const existingMsg = existingMessagesByKey.get(key);
        if (existingMsg) {
          // If a match key exists, prefer server messages over log messages
          // Server messages have IDs that don't start with "outgoing-" or "incoming-"
          const isExistingServerMsg =
            !existingMsg.id.startsWith("outgoing-") &&
            !existingMsg.id.startsWith("incoming-");
          const isNewLogMsg =
            msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");
          const isNewServerMsg =
            !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");

          // If existing is server and new is log, filter out the new log message
          // UNLESS it's an edited message (we need it to update the existing message)
          if (isExistingServerMsg && isNewLogMsg) {
            // Allow edited messages through so they can update existing messages
            if (msg.isEdited && (msg.mid || msg.serverMsgId)) {
              return true;
            }
            return false;
          }
          // If existing is log and new is server, keep the server message
          // The log message will be replaced in the merge step below
          if (!isExistingServerMsg && isNewServerMsg) {
            return true; // Keep server message, log message will be removed in merge
          }
          // Two distinct log lines (same text, same second): keep both; only drop true re-renders
          if (!isExistingServerMsg && isNewLogMsg) {
            if (existingMsg.id === msg.id) {
              return false;
            }
            return true;
          }
          // If both are server messages with same key, filter out the new one
          // UNLESS it's an edited message (same mid or serverMsgId)
          if (isExistingServerMsg && isNewServerMsg) {
            // If this is an edited message, allow it through
            if (msg.isEdited && (msg.mid || msg.serverMsgId)) {
              return true;
            }
            return false;
          }
        }
        return true;
      });

      // If no new unique messages, return existing state
      if (uniqueNewMessages.length === 0) {
        return prev;
      }

      // If no existing messages for this peer, return new messages
      if (currentPeerMessages.length === 0) {
        return uniqueNewMessages;
      }

      const updatedMessages = currentPeerMessages.map((existingMsg) => {
        // Find ALL matching edited messages (there might be duplicates)
        const allMatchingEditedMsgs = uniqueNewMessages.filter((newMsg) => {
          if (!newMsg.isEdited) return false;

          // Check by mid
          if (newMsg.mid && existingMsg.mid && newMsg.mid === existingMsg.mid) {
            return true;
          }

          // Check by serverMsgId
          if (
            newMsg.serverMsgId &&
            existingMsg.serverMsgId &&
            newMsg.serverMsgId === existingMsg.serverMsgId
          ) {
            return true;
          }

          // Check by id
          if (newMsg.id === existingMsg.id) {
            return true;
          }

          return false;
        });

        // If multiple matches, prefer the one with the most recent timestamp or different content
        // Sort by timestamp (most recent first) or by content length (longer = likely newer edit)
        let editedMsg =
          allMatchingEditedMsgs.length > 0
            ? allMatchingEditedMsgs.sort((a, b) => {
                // First, prefer messages with different content (actual edits)
                const aIsDifferent = a.content !== existingMsg.content;
                const bIsDifferent = b.content !== existingMsg.content;
                if (aIsDifferent && !bIsDifferent) return -1;
                if (!aIsDifferent && bIsDifferent) return 1;

                // If both are different or both same, prefer longer content (more recent edit)
                if (a.content.length !== b.content.length) {
                  return b.content.length - a.content.length;
                }

                // If same length, prefer by timestamp if available
                const aTime = a.createdAt
                  ? typeof a.createdAt === "string"
                    ? new Date(a.createdAt).getTime()
                    : a.createdAt.getTime()
                  : 0;
                const bTime = b.createdAt
                  ? typeof b.createdAt === "string"
                    ? new Date(b.createdAt).getTime()
                    : b.createdAt.getTime()
                  : 0;
                return bTime - aTime;
              })[0]
            : null;

        if (allMatchingEditedMsgs.length > 1) {
        }

        // Debug: log if we're looking for a match for this message
        if (existingMsg.serverMsgId || existingMsg.mid) {
        }

        if (editedMsg) {
          // Update the existing message with new content and mark as edited
          // Ensure we're using the new content from the edited message
          const newContent = editedMsg.content || existingMsg.content;

          const updatedMessage = {
            ...existingMsg,
            content: newContent, // Use the new content from edited message
            isEdited: true,
            mid: editedMsg.mid || existingMsg.mid, // Preserve mid if available
            serverMsgId: editedMsg.serverMsgId || existingMsg.serverMsgId, // Preserve serverMsgId
            // Update other fields that might have changed
            messageType: editedMsg.messageType || existingMsg.messageType,
            imageUrl: editedMsg.imageUrl || existingMsg.imageUrl,
            audioUrl: editedMsg.audioUrl || existingMsg.audioUrl,
            fileUrl: editedMsg.fileUrl || existingMsg.fileUrl,
          };

          return updatedMessage;
        }
        return existingMsg;
      });

      // Filter out edited messages from uniqueNewMessages (they've been merged into updatedMessages)
      const updatedMids = new Set(
        uniqueNewMessages
          .filter((msg) => msg.mid && msg.isEdited)
          .map((msg) => msg.mid!)
      );
      const newMessagesWithoutEdited = uniqueNewMessages.filter(
        (msg) => !msg.mid || !updatedMids.has(msg.mid)
      );

      // First, collect all server messages and their match keys
      const allMessagesTemp = [
        ...updatedMessages,
        ...newMessagesWithoutEdited,
      ].filter((msg) => msg !== null && msg.createdAt); // Filter out null messages and messages without createdAt

      const serverMessageKeys = new Set();
      allMessagesTemp.forEach((msg) => {
        const isServerMsg =
          !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");
        if (isServerMsg) {
          const key = createMatchKey(msg);
          serverMessageKeys.add(key);
        }
      });

      // Sort by logIndex to maintain chronological order
      const allMessages = allMessagesTemp
        .filter((msg, index, self) => {
          // Remove duplicates by ID (first check)
          const idIndex = self.findIndex((m) => m.id === msg.id);
          if (idIndex !== index) {
            return false;
          }
          // Also check by match key to catch any remaining duplicates
          const key = createMatchKey(msg);
          const isLogMsg =
            msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");

          // If this is a log message and we have a server message with the same key, filter it out
          if (isLogMsg && serverMessageKeys.has(key)) {
            return false;
          }

          // Remove duplicates by match key, but log rows stay unique per id (same text, rapid sends)
          const dedupKeyForRow = (m: Message): string => {
            const mk = createMatchKey(m);
            if (
              m.id.startsWith("outgoing-") ||
              m.id.startsWith("incoming-")
            ) {
              return `${mk}#${m.id}`;
            }
            return mk;
          };
          const keyIndex = self.findIndex(
            (m) => dedupKeyForRow(m) === dedupKeyForRow(msg)
          );
          if (keyIndex !== index) {
            return false;
          }

          return true;
        })
        .sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return aDate.getTime() - bDate.getTime();
        });

      // Return merged messages along with messages from other peers
      const otherPeerMessages = prev.filter((msg) => msg.peerId !== peerId);
      return [...otherPeerMessages, ...allMessages];
    });
  }, [logs, peerId, groupId, userId, selectedContact]);

  // Sync chatClient prop to ref
  useEffect(() => {
    chatClientRef.current = chatClient;
  }, [chatClient]);

  // Load history (exhaust Agora, then paginate DB) when peer / group / chat client changes (once per conversation)
  useEffect(() => {
    if (!peerId || !groupId || !chatClient) return;

    const historyKey = `${peerId}|${groupId}`;
    const currentFetchedPeer = fetchedPeersRef.current.currentPeer;

    if (currentFetchedPeer !== historyKey) {
      fetchedPeersRef.current.fetchedPeers = new Set();
      fetchedPeersRef.current.currentPeer = historyKey;
      setCursor(null);
      setHasMore(true);
      agoraHistoryCursorRef.current = null;
      agoraHistoryExhaustedRef.current = false;
      minAgoraTimeMsRef.current = undefined;
    }

    if (fetchedPeersRef.current.fetchedPeers.has(historyKey)) {
      return;
    }

    // Reserve immediately so a second effect run (e.g. chatClient reference update)
    // before the async work finishes does not start another fetch-messages chain.
    fetchedPeersRef.current.fetchedPeers.add(historyKey);

    const checkAndFetch = async (): Promise<void> => {
      try {
        await fetchInitialMessages();
      } catch (err) {
        console.error("Error while fetching:", err);
        fetchedPeersRef.current.fetchedPeers.delete(historyKey);
      }
    };

    void checkAndFetch();
  }, [peerId, groupId, chatClient]);

  // Filter messages to only show current conversation when displaying

  const currentConversationMessages = messages.filter(
    (msg) => msg.peerId === peerId
  );

  const newestMessageTailKey = useMemo(() => {
    if (!peerId) return null;
    const list = messages.filter((msg) => msg.peerId === peerId);
    if (list.length === 0) return null;
    const sorted = [...list].sort((a, b) => {
      const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aT - bT;
    });
    const m = sorted[sorted.length - 1];
    return `${m.id}|${m.createdAt ? new Date(m.createdAt).getTime() : 0}`;
  }, [peerId, messages]);

  useEffect(() => {
    latestTailKeyRef.current = null;
  }, [peerId]);

  // Scroll to bottom when the chronologically newest message changes (send or receive),
  // not when older pages are prepended. Ignore skip refs so new events still scroll after a load-more.
  useEffect(() => {
    if (!peerId) return;
    if (newestMessageTailKey === null) {
      latestTailKeyRef.current = null;
      return;
    }
    if (isFetchingHistory) return;

    if (latestTailKeyRef.current === newestMessageTailKey) return;
    latestTailKeyRef.current = newestMessageTailKey;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = chatAreaRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
      });
    });
  }, [peerId, newestMessageTailKey, isFetchingHistory]);

  // Reset input key when peer changes to ensure clean state
  useEffect(() => {
    setInputResetKey(0);
  }, [peerId]);

  // Watch for message clearing after send to reset input
  useEffect(() => {
    // Detect when message transitions from non-empty to empty (after sending)
    // This ensures the input remounts AFTER the message is cleared
    const prevMessage = prevMessageRef.current;
    const currentMessage = message || "";

    // If message was non-empty and is now empty, and we have a peer, reset input
    const prevIsEmpty =
      typeof prevMessage === "string" ? prevMessage.trim() : prevMessage;
    const currentIsEmpty =
      typeof currentMessage === "string"
        ? currentMessage.trim()
        : currentMessage;
    if (prevIsEmpty && !currentIsEmpty && peerId) {
      // Message was cleared after send, increment key to remount input
      setInputResetKey((prev) => prev + 1);
    }

    // Update ref for next comparison
    prevMessageRef.current = currentMessage;
  }, [message, peerId]);

  // Restore focus to input after it remounts (when reset key changes)
  useEffect(() => {
    if (inputRef.current && selectedContact) {
      // Small delay to ensure input is fully mounted
      const timer = setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [inputResetKey, selectedContact]);

  const isSendingRef = useRef(false);

  const handleSendMessage = (): void => {
    // Prevent multiple simultaneous sends
    if (isSendingRef.current) {
      return;
    }

    // Capture the exact message value to send BEFORE any state changes
    const currentMessage = draftAttachment ? getDraftCaption() : message;
    const hasMessage =
      typeof currentMessage === "string"
        ? currentMessage.trim()
        : currentMessage;

    if (!hasMessage && !draftAttachment) {
      return;
    }

    // For draft attachments, we need to send the full JSON payload, not just the caption
    const messageToSend = draftAttachment ? message : currentMessage;

    // Mark as sending immediately to prevent any other sends
    isSendingRef.current = true;

    // Clear the message state immediately to prevent it from being read again
    if (draftAttachment) {
      clearDraftAttachment();
    } else {
      setMessage("");
    }

    // Call onSend with the message value directly to avoid race conditions
    // The parent will use this value instead of reading from the message prop
    onSend(messageToSend);

    // Reset the flag after a delay to allow the send to complete
    setTimeout(() => {
      isSendingRef.current = false;
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  // Close media popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        mediaPopupRef.current &&
        !mediaPopupRef.current.contains(target) &&
        !(target as Element).closest(".icon-btn")
      ) {
        setShowMediaPopup(false);
      }
    };

    if (showMediaPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showMediaPopup]);

  // 👉 Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("click", handleClickOutside, true);
    return () =>
      document.removeEventListener("click", handleClickOutside, true);
  }, []);

  // Handle emoji selection and make navigation bar scrollable
  useEffect(() => {
    if (!showEmojiPicker) return;

    let pickerElement: Element | null = null;
    let handleEmojiSelect: ((event: Event) => void) | null = null;

    const setupEmojiPicker = () => {
      // emojiPickerRef points to the container, so we need to find the emoji-picker element
      pickerElement =
        emojiPickerRef.current?.querySelector("emoji-picker") ||
        document.querySelector("emoji-picker.emoji-picker-element");
      if (!pickerElement) return;

      // Add event listener for emoji selection
      // emoji-picker-element fires different events, try multiple
      handleEmojiSelect = (event: Event): void => {
        const customEvent = event as CustomEvent;
        // Try different event structures
        const emoji =
          customEvent.detail?.unicode ||
          (
            customEvent.detail as {
              emoji?: { unicode?: string };
              unicode?: string;
            }
          )?.emoji?.unicode ||
          (customEvent.detail as { unicode?: string })?.unicode ||
          customEvent.detail ||
          (event as { emoji?: string }).emoji ||
          (event as { unicode?: string }).unicode;

        if (emoji && typeof emoji === "string") {
          setMessage((prev: string) => prev + emoji);
        }
      };

      // Try multiple event names that emoji-picker-element might use
      pickerElement.addEventListener("emoji-click", handleEmojiSelect);
      pickerElement.addEventListener("emojiClick", handleEmojiSelect);
      pickerElement.addEventListener("change", handleEmojiSelect);

      // Try to access shadow DOM for navigation styling
      const shadowRoot = pickerElement.shadowRoot;
      if (shadowRoot) {
        // Common selectors for navigation in emoji-picker-element
        const navSelectors = [
          "nav",
          ".nav",
          '[part="nav"]',
          ".category-nav",
          ".epr-category-nav",
          ".category-buttons",
          'div[role="tablist"]',
          ".tabs",
        ];

        for (const selector of navSelectors) {
          const navElement = shadowRoot.querySelector(selector);
          if (navElement && navElement instanceof HTMLElement) {
            navElement.style.overflowX = "auto";
            navElement.style.overflowY = "hidden";
            navElement.style.whiteSpace = "nowrap";
            navElement.style.display = "flex";
            navElement.style.scrollbarWidth = "thin";
            (
              navElement.style as unknown as {
                webkitOverflowScrolling?: string;
              }
            ).webkitOverflowScrolling = "touch";
            break; // Found and styled, exit
          }
        }

        // Also try to find any horizontal scrollable container
        const allDivs = shadowRoot.querySelectorAll("div");
        allDivs.forEach((div) => {
          const computedStyle = window.getComputedStyle(div);
          if (
            computedStyle.display === "flex" &&
            computedStyle.flexDirection === "row" &&
            div.children.length > 5 // Likely the nav bar with multiple category buttons
          ) {
            div.style.overflowX = "auto";
            div.style.overflowY = "hidden";
            div.style.whiteSpace = "nowrap";
          }
        });
      }
    };

    // Wait for the component to render
    const timeoutId = setTimeout(setupEmojiPicker, 100);

    return () => {
      clearTimeout(timeoutId);
      // Cleanup event listeners
      if (pickerElement && handleEmojiSelect) {
        pickerElement.removeEventListener("emoji-click", handleEmojiSelect);
        pickerElement.removeEventListener("emojiClick", handleEmojiSelect);
        pickerElement.removeEventListener("change", handleEmojiSelect);
      }
    };
  }, [showEmojiPicker]);

  // Handle Escape key to close image viewer
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && imageViewerUrl) {
        closeImageViewer();
      }
      // Also cancel recording on Escape
      if (e.key === "Escape" && (isRecording || isRecordingStopped)) {
        cancelAudioRecording();
      }
    };

    if (imageViewerUrl || isRecording || isRecordingStopped) {
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [imageViewerUrl, isRecording, isRecordingStopped]);

  // Cleanup effect for recording
  useEffect(() => {
    return () => {
      // Cleanup on unmount - always release mic if any recording resources exist
        shouldSendRecordingRef.current = false;

      // Stop MediaRecorder first
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }

      // Stop all tracks from MediaRecorder's stream
      if (recorder?.stream) {
        recorder.stream.getTracks().forEach((track) => {
          if (track.readyState === "live") {
            track.stop();
        }
        });
      }

      // Stop all tracks from our ref
        if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => {
          if (track.readyState === "live") {
            track.stop();
        }
        });
        audioStreamRef.current = null;
      }

      // Clear refs
      mediaRecorderRef.current = null;

        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  const handleMediaSelect = (type: "photos" | "camera" | "file"): void => {
    setShowMediaPopup(false);

    if (type === "photos") {
      // Open photo gallery picker (without capture attribute)
      photoInputRef.current?.click();
    } else if (type === "file") {
      // Open file picker
      fileInputRef.current?.click();
    } else if (type === "camera") {
      // Try in-app camera capture (works on desktop + mobile)
      setShowCameraCapture(true);
      startCamera();
    }
  };

  const handleFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedMedia(file);
      // You can preview the file here or send it directly
      handleSendMedia(file);
    }
    // Reset input to allow selecting the same file again
    event.target.value = "";
  };

  const handlePhotoSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedMedia(file);
      handleSendMedia(file);
    }
    event.target.value = "";
  };

  const handleSendMedia = async (file: File): Promise<void> => {
    if (!peerId || !file) return;

    // Prevent concurrent media uploads
    if (isSendingRef.current) {
      return;
    }

    try {
      // 🧹 Clean filename
      const safeFileName = file.name
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "_");
      const objectKey = `uploads/${
        peerId || "user"
      }/${Date.now()}-${safeFileName}`;

      // 1️⃣ Request pre-signed URL
      const { data } = await axios.post(config.api.generatePresignUrl, {
        objectKey,
        expiresInMinutes: config.upload.expiresInMinutes,
      });

      const { url: uploadUrl, fileUrl } = data;

      // 2️⃣ Upload to S3
      await axios.put(uploadUrl, file, {
        headers: { "Content-Type": file.type },
      });

      const getImageDimensions = (
        url: string
      ): Promise<{ width: number; height: number }> => {
        return new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.onerror = () => resolve({ width: 1280, height: 720 });
          img.src = url;
        });
      };

      // 3️⃣ Build chat message
      let payload;

      if (file.type.startsWith("image/")) {
        const dims = await getImageDimensions(fileUrl);

        payload = {
          type: "image",
          url: fileUrl,
          fileName: safeFileName,
          mimeType: file.type,
          size: file.size,
          width: dims.width,
          height: dims.height,
        };
      } else {
        payload = {
          type: "file",
          url: fileUrl,
          fileName: safeFileName,
          mimeType: file.type,
          size: file.size,
        };
      }

      // Send directly without staging in composer (avoids attachment preview above input)
      isSendingRef.current = true;
      setSelectedMedia(null);
      onSend(JSON.stringify(payload));
      setTimeout(() => {
        isSendingRef.current = false;
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error("❌ Upload failed:", error);
      alert("Error uploading file. Please try again.");
    }
  };

  // Camera: start/stop and capture
  const checkForMultipleCameras = async (): Promise<boolean> => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return false;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(
        (device) => device.kind === "videoinput"
      );
      return videoInputs.length > 1;
    } catch {
      return false;
    }
  };

  const startCamera = async (
    facingMode: "user" | "environment" = cameraFacingMode
  ): Promise<void> => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Fallback to native file input capture if getUserMedia unavailable
        cameraInputRef.current?.click();
        return;
      }

      // Check if device has multiple cameras
      const multipleCameras = await checkForMultipleCameras();
      setHasMultipleCameras(multipleCameras);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode },
        audio: false,
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (e) {
      console.error("Camera error:", e);
      // Fallback to file input if permission denied or not available
      cameraInputRef.current?.click();
      setShowCameraCapture(false);
    }
  };

  const flipCamera = async (): Promise<void> => {
    // Stop current camera
    stopCamera();

    // Toggle facing mode
    const newFacingMode =
      cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(newFacingMode);

    // Start camera with new facing mode
    await startCamera(newFacingMode);
  };

  const stopCamera = (): void => {
    try {
      const stream = mediaStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
      }
    } catch {}
  };

  const closeCamera = (): void => {
    stopCamera();
    setShowCameraCapture(false);
  };

  const capturePhoto = async (): Promise<void> => {
    try {
      const video = videoRef.current;
      if (!video) return;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        async (blob) => {
          if (!blob) return;
          const file = new File([blob], "camera-photo.jpg", {
            type: blob.type || "image/jpeg",
          });
          await handleSendMedia(file);
          closeCamera();
        },
        "image/jpeg",
        0.92
      );
    } catch (e) {
      console.error("Capture error:", e);
    }
  };

  // Helper function to convert audio blob to WAV format
  const convertToWAV = async (audioBlob: Blob): Promise<Blob> => {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const audioContext = new AudioContextClass();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const samples = audioBuffer.getChannelData(0); // Get first channel

      // Create WAV file buffer
      const buffer = new ArrayBuffer(44 + samples.length * 2);
      const view = new DataView(buffer);

      // WAV header
      const writeString = (offset: number, string: string): void => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      writeString(0, "RIFF");
      view.setUint32(4, 36 + samples.length * 2, true);
      writeString(8, "WAVE");
      writeString(12, "fmt ");
      view.setUint32(16, 16, true); // fmt chunk size
      view.setUint16(20, 1, true); // audio format (1 = PCM)
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * numChannels * 2, true); // byte rate
      view.setUint16(32, numChannels * 2, true); // block align
      view.setUint16(34, 16, true); // bits per sample
      writeString(36, "data");
      view.setUint32(40, samples.length * 2, true);

      // Convert float samples to 16-bit PCM
      let offset = 44;
      for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }

      audioContext.close();
      return new Blob([buffer], { type: "audio/wav" });
    } catch (error) {
      console.error("Error converting to WAV:", error);
      // Fallback: return original blob if conversion fails
      return audioBlob;
    }
  };

  // Audio recording functions
  const startAudioRecording = async (): Promise<void> => {
    try {
      // Prevent starting recording if we're in the middle of sending a message
      if (isSendingRef.current) {
        return;
      }

      // Prevent starting if already recording or stopped (waiting to send)
      if (isRecording || isRecordingStopped) {
        return;
      }

      // Prevent starting if we already have a stream (double-click protection)
      if (audioStreamRef.current || mediaRecorderRef.current) {
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Audio recording is not supported in your browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Double-check we didn't start recording while waiting for getUserMedia
      if (audioStreamRef.current || mediaRecorderRef.current) {
        // Another recording started, stop this new stream
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      audioStreamRef.current = stream;
      setRecordingStreamForViz(stream);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/ogg")
          ? "audio/ogg"
          : "audio/mp4",
      });

      audioChunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Ensure all tracks are stopped (backup in case stopAudioRecording didn't complete)
        try {
          if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach((track) => {
              if (track.readyState === "live") {
                track.stop();
              }
            });
          }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((track) => {
              if (track.readyState === "live") {
                track.stop();
              }
            });
          }
        } catch (e) {
          console.error("Error stopping tracks in onstop:", e);
        }
          audioStreamRef.current = null;

        // Calculate actual duration from start time (more accurate than state)
        const actualDuration = recordingStartTimeRef.current
          ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000)
          : recordingDurationRef.current || recordingDuration;

        // Stop the timer
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        // If cancelled, just clear everything
        if (!shouldSendRecordingRef.current) {
          setIsRecording(false);
          setIsRecordingStopped(false);
          setRecordingDuration(0);
          setStoppedRecordingDuration(0);
          recordingStartTimeRef.current = null;
          recordingDurationRef.current = 0;
          stoppedAudioBlobRef.current = null;
          audioChunksRef.current = [];
          shouldSendRecordingRef.current = true;
          return;
        }

        // Store the audio blob for later sending
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: mediaRecorder.mimeType || "audio/webm",
          });
          // Convert to WAV format
          const wavBlob = await convertToWAV(audioBlob);
          stoppedAudioBlobRef.current = wavBlob;
          setStoppedRecordingDuration(actualDuration);
          setIsRecordingStopped(true);
        }

        // Clear recording state but keep stopped state
        setIsRecording(false);
        recordingStartTimeRef.current = null;
        recordingDurationRef.current = 0;
      };

      shouldSendRecordingRef.current = true;

      // Clear any existing timer before starting a new one
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now(); // Record start time
      recordingDurationRef.current = 0; // Reset ref

      // Start timer - calculate duration from start time to avoid double increments
      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - recordingStartTimeRef.current) / 1000
          );
          recordingDurationRef.current = elapsed;
          setRecordingDuration(elapsed);
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting audio recording:", error);
      alert(
        "Failed to start audio recording. Please check microphone permissions."
      );
      setIsRecording(false);
      setRecordingStreamForViz(null);
    }
  };

  // Helper function to release microphone - always releases regardless of state
  const releaseMicrophone = (): void => {
    // Get reference to the stream before clearing anything
    const streamFromRecorder = mediaRecorderRef.current?.stream;
    const streamFromRef = audioStreamRef.current;

    // Stop tracks from MediaRecorder's stream
    if (streamFromRecorder) {
      streamFromRecorder.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          track.stop();
        }
      });
    }

    // Also stop from our ref (might be the same stream, but ensure all tracks are stopped)
    if (streamFromRef) {
      streamFromRef.getTracks().forEach((track) => {
        if (track.readyState === "live") {
          track.stop();
        }
      });
    }

    // Clear the refs
    audioStreamRef.current = null;
    setRecordingStreamForViz(null);

    // Clear the timer
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const stopAudioRecording = (): void => {
    // First stop the media recorder if it exists and is recording
    // This ensures we capture all audio data before releasing the stream
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    // Then release the microphone
    releaseMicrophone();

    // Clear the MediaRecorder reference
    mediaRecorderRef.current = null;
  };

  const cancelAudioRecording = (): void => {
    // Set flag to prevent storing the blob
      shouldSendRecordingRef.current = false;
      // Clear chunks without sending
      audioChunksRef.current = [];

    // First stop the media recorder if it exists and is recording
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    // Then release the microphone
    releaseMicrophone();

    // Clear the MediaRecorder reference
    mediaRecorderRef.current = null;

    // If in stopped state, also clear that
    if (isRecordingStopped) {
      setIsRecordingStopped(false);
      setRecordingDuration(0);
      setStoppedRecordingDuration(0);
      stoppedAudioBlobRef.current = null;
    }
  };

  const sendStoppedRecording = async (): Promise<void> => {
    const blob = stoppedAudioBlobRef.current;
    const durationSec = stoppedRecordingDuration;
    if (!blob || !isRecordingStopped) return;

    releaseMicrophone();
    mediaRecorderRef.current = null;

    // Close recording UI immediately; upload and chat send happen in the background
    setIsRecordingStopped(false);
    setRecordingDuration(0);
    setStoppedRecordingDuration(0);
    stoppedAudioBlobRef.current = null;
    audioChunksRef.current = [];

    await handleSendAudio(blob, durationSec);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const handleSendAudio = async (
    audioBlob: Blob,
    durationOverride: number | null = null
  ): Promise<void> => {
    if (!peerId || !audioBlob) return;

    // Use provided duration or fall back to state
    const durationToUse =
      durationOverride !== null ? durationOverride : recordingDuration;

    try {
      // Determine file extension based on MIME type (WAV format)
      const extension = "wav";

      // Create a File object from the blob for consistent handling
      const fileName = `audio-recording-${Date.now()}.${extension}`;
      const audioFile = new File([audioBlob], fileName, {
        type: audioBlob.type,
      });

      // Clean filename for S3
      const safeFileName = fileName
        .replace(/\s+/g, "_")
        .replace(/[^\w.-]/g, "_");
      const objectKey = `uploads/${
        peerId || "user"
      }/${Date.now()}-${safeFileName}`;

      // 1️⃣ Request pre-signed URL
      const { data } = await axios.post(config.api.generatePresignUrl, {
        objectKey,
        expiresInMinutes: config.upload.expiresInMinutes,
      });

      const { url: uploadUrl, fileUrl } = data;

      // 2️⃣ Upload to S3
      await axios.put(uploadUrl, audioFile, {
        headers: { "Content-Type": audioBlob.type },
      });

      // 3️⃣ Build chat message with S3 URL
      const payload = {
        type: "audio",
        url: fileUrl, // Use S3 URL instead of blob URL
        fileName: safeFileName,
        mimeType: audioBlob.type,
        size: audioBlob.size,
        duration: durationToUse, // Duration in seconds (will be converted to ms in App.jsx)
      };

      // Send directly without going through draft attachment preview
      isSendingRef.current = true;
      onSend(JSON.stringify(payload));

      // Reset the sending flag and scroll to bottom
      setTimeout(() => {
        isSendingRef.current = false;
        scrollToBottom();
      }, 100);
    } catch (error) {
      console.error("Error uploading audio:", error);
      alert("Error uploading audio. Please try again.");
      setMessage(""); // Clear on error
    }
  };

  // Image viewer helpers
  const openImageViewer = (url: string, alt?: string): void => {
    if (!url) return;
    // Dismiss keyboard before input unmounts (mobile PWA); avoids focus churn with overlay
    inputRef.current?.blur();
    setImageViewerUrl(url);
    setImageViewerAlt(alt || "Image");
    // Optional: lock background scroll if desired
    document.body.style.overflow = "hidden";
  };

  const closeImageViewer = (): void => {
    setImageViewerUrl("");
    setImageViewerAlt("");
    document.body.style.overflow = "";
  };

  // Video/Audio player helpers
  const openVideoPlayer = (
    videoUrl: string,
    callType?: "video_call" | "voice_call"
  ): void => {
    if (!videoUrl) return;

    // Open recording in the same tab using existing player components
    const type = callType || "video_call";
    if (type === "voice_call") {
      setAudioPlayerUrl(videoUrl);
    } else {
      setVideoPlayerUrl(videoUrl);
    }
    // Lock background scroll when player is open
    document.body.style.overflow = "hidden";
  };

  const closeVideoPlayer = (): void => {
    setVideoPlayerUrl("");
    document.body.style.overflow = "";
  };

  const closeAudioPlayer = (): void => {
    setAudioPlayerUrl("");
    document.body.style.overflow = "";
  };

  /** Oldest Agora server time (ms) for DB `from` after Agora history is exhausted. */
  const minAgoraMessageTimeMs = (msgs: AgoraMessage[]): number | undefined => {
    const times = msgs
      .map((m) => m.time)
      .filter(
        (t): t is number =>
          typeof t === "number" && !Number.isNaN(t) && Number.isFinite(t)
      );
    if (times.length === 0) return undefined;
    return Math.min(...times);
  };

  // Exhaust Agora history first, then DB: first DB page uses cursor = oldest Agora message time (ms); paginate DB until no nextCursor.
  const fetchInitialMessages = async (): Promise<void> => {
    if (!groupId || !chatClient) {
      console.warn("groupId or chatClient missing, skipping fetch");
      return;
    }

    setIsFetchingHistory(true);
    try {
      const conversationId = peerId?.startsWith("user_")
        ? peerId
        : `user_${peerId ?? groupId}`;

      const pageSize = config.chat.pageSize || 20;
      const maxDbPages = 500;

      const client = chatClient as Connection & {
        getHistoryMessages?: (options: {
          targetId: string;
          chatType: string;
          pageSize: number;
          searchDirection: string;
          cursor?: string;
        }) => Promise<{
          messages?: unknown[];
          cursor?: string;
          isLast?: boolean;
        }>;
      };

      let agoraMessages: AgoraMessage[] = [];

      // 1) Fetch all pages from Agora (group thread) before touching DB; stop on SDK/roaming errors
      if (client.getHistoryMessages) {
        let agoraCursor: string | undefined;
        for (;;) {
          let agoraResMaybe: {
            messages?: unknown[];
            cursor?: string;
            isLast?: boolean;
          };
          try {
            agoraResMaybe = await client.getHistoryMessages({
              targetId: groupId,
              chatType: "groupChat",
              pageSize,
              searchDirection: "up",
              ...(agoraCursor ? { cursor: agoraCursor } : {}),
            });
          } catch {
            break;
          }
          const batch = (agoraResMaybe?.messages || []) as AgoraMessage[];
          agoraMessages.push(...batch);

          const batchMin = minAgoraMessageTimeMs(batch);
          if (batchMin !== undefined) {
            minAgoraTimeMsRef.current =
              minAgoraTimeMsRef.current === undefined
                ? batchMin
                : Math.min(minAgoraTimeMsRef.current, batchMin);
          }

          const noMoreAgora =
            batch.length === 0 ||
            !agoraResMaybe?.cursor ||
            agoraResMaybe?.isLast;
          if (noMoreAgora) break;
          agoraCursor = String(agoraResMaybe.cursor);
        }
      }

      agoraHistoryCursorRef.current = null;
      agoraHistoryExhaustedRef.current = true;

      let apiMessages: ApiMessage[] = [];
      let lastDbNextCursor: string | undefined;

      // 2) DB: cursor = timestamp (ms) of oldest Agora message; then follow nextCursor until exhausted
      const oldestAgoraMs = minAgoraTimeMsRef.current;
      let dbCursor: string | undefined =
        oldestAgoraMs !== undefined ? String(oldestAgoraMs) : undefined;
      let dbFirstPageAfterAgora = oldestAgoraMs !== undefined;

      try {
        for (let p = 0; p < maxDbPages; p++) {
          const apiUrl = new URL(config.api.fetchMessages);
          apiUrl.searchParams.append("conversationId", conversationId);
          apiUrl.searchParams.append("limit", String(pageSize));
          if (dbCursor) {
            apiUrl.searchParams.append("cursor", dbCursor);
            if (dbFirstPageAfterAgora) {
              apiUrl.searchParams.append("from", dbCursor);
              dbFirstPageAfterAgora = false;
            }
          }

          const response = await fetch(apiUrl.toString());
          if (!response.ok) break;

          const apiRes: {
            messages?: ApiMessage[];
            nextCursor?: string;
          } = await response.json();
          const pageMsgs = apiRes?.messages || [];
          apiMessages.push(...pageMsgs);

          // Stop after an empty page: some APIs still return nextCursor with no messages,
          // which caused a redundant second fetch-messages call.
          if (pageMsgs.length === 0) {
            lastDbNextCursor = undefined;
            break;
          }

          const next = apiRes?.nextCursor;
          if (!next) {
            lastDbNextCursor = undefined;
            break;
          }
          lastDbNextCursor = next;
          dbCursor = next;
        }
      } catch {
        // DB fetch failed; still show Agora messages
      }

      if (lastDbNextCursor) {
        setCursor(lastDbNextCursor);
        setHasMore(true);
      } else {
        setCursor(null);
        setHasMore(false);
      }

      // Convert API messages to Agora format
      const convertedApiMessages = apiMessages
        .map((msg: unknown) => convertApiMessageToFormat(msg as ApiMessage))
        .filter(
          (msg: AgoraMessage | null): msg is AgoraMessage => msg !== null
        );

      // Combine messages from both sources
      const oldMessages = [...agoraMessages, ...convertedApiMessages];

      // Filter out null messages (healthCoachChanged, mealPlanUpdate, etc.)
      const convertedMessages = oldMessages.filter(
        (msg: AgoraMessage | null): msg is AgoraMessage => msg !== null
      );

      const formatted = convertedMessages
        .map((msg: AgoraMessage) =>
          formatMessage(msg, userId, peerId || "", selectedContact, coachInfo)
        )
        .filter((msg: Message | null): msg is Message => msg !== null); // Filter out null messages (hidden call initiate messages, etc.)

      // 🟢 DEDUPLICATE messages by ID: Filter out duplicates from both Agora and API
      // This prevents the same message from appearing twice when fetched from both sources
      const seenMessageIds = new Set<string>();
      const deduplicatedFormatted = formatted.filter((msg: Message) => {
        // Use message ID for deduplication
        if (msg.id) {
          if (seenMessageIds.has(msg.id)) {
            return false; // Filter out duplicate
          }
          seenMessageIds.add(msg.id);
        }

        // Also deduplicate products messages by product IDs (existing logic)
        if (msg.messageType === "products" && msg.products) {
          // Extract first product ID for deduplication key
          let firstProductId = "";
          if (Array.isArray(msg.products)) {
            firstProductId = msg.products[0]?.id || "";
          } else if (typeof msg.products === "string") {
            try {
              const parsed = JSON.parse(msg.products);
              if (Array.isArray(parsed) && parsed[0]?.id) {
                firstProductId = parsed[0].id;
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (firstProductId) {
            const key = `products-${firstProductId}-${msg.sender}`;
            if (seenMessageIds.has(key)) {
              return false; // Filter out duplicate
            }
            seenMessageIds.add(key);
          }
        }
        return true; // Keep all messages that pass deduplication
      });

      // Find the most recent message from history to update last message
      if (deduplicatedFormatted.length > 0 && onUpdateLastMessageFromHistory) {
        // Sort by timestamp descending to get the most recent
        const sortedFormatted = [...deduplicatedFormatted].sort((a, b) => {
          const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return bDate.getTime() - aDate.getTime();
        });
        const mostRecentMessage = sortedFormatted[0];
        if (mostRecentMessage && peerId) {
          onUpdateLastMessageFromHistory(peerId, mostRecentMessage);
        }
      }

      // Merge with existing messages instead of replacing
      setMessages((prev) => {
        // Get existing messages for this peer
        const existingMessages = prev.filter(
          (msg: Message) => msg.peerId === peerId
        );

        // Create a set of existing message IDs to avoid duplicates
        const existingIds = new Set(existingMessages.map((msg) => msg.id));

        // Filter out fetched messages that already exist by ID
        const newFetchedMessages = deduplicatedFormatted
          .reverse()
          .filter((msg: Message) => !existingIds.has(msg.id));

        // If there are no existing messages for this peer, return fetched ones along with messages from other peers
        if (existingMessages.length === 0) {
          const otherPeerMessages = prev.filter((msg) => msg.peerId !== peerId);
          return [...otherPeerMessages, ...newFetchedMessages];
        }

        // For messages from logs (with generated IDs), try to match with server messages
        // This ensures we use server timestamps instead of log timestamps
        // Match by normalizing content (remove whitespace, handle JSON differences) and sender
        const normalizeContent = (
          content: string | null | undefined
        ): string => {
          if (!content) return "";
          try {
            // Try to parse as JSON and re-stringify to normalize
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed);
          } catch {
            // Not JSON, return trimmed content
            return String(content).trim();
          }
        };

        // Create a matching key for custom messages using messageType and identifying fields
        const createMatchKey = (msg: Message): string => {
          const normalizedContent = normalizeContent(msg.content);
          const createdAt = msg.createdAt
            ? new Date(msg.createdAt)
            : new Date();
          const timeWindow = Math.floor(createdAt.getTime() / 300000); // 5-minute window

          // For custom messages, include messageType and identifying fields in the key
          if (msg.messageType && msg.messageType !== "text") {
            let customKey = "";

            // Try to extract from message fields first
            if (msg.messageType === "image" && msg.imageUrl) {
              customKey = msg.imageUrl;
            } else if (msg.messageType === "audio" && msg.audioUrl) {
              customKey = msg.audioUrl;
            } else if (msg.messageType === "file" && msg.fileUrl) {
              customKey = msg.fileUrl;
            } else if (msg.messageType === "call") {
              // For call messages, use content-based matching (not ID) so log and server messages match
              // Extract action and duration from message object or content
              let callAction = msg.callAction || "";
              let callDuration =
                msg.callDurationSeconds != null
                  ? String(msg.callDurationSeconds)
                  : "";
              let callType = msg.callType || "video";
              let callChannel = msg.channel || "";

              // If fields not on message object, try to extract from content
              if (
                !callAction ||
                !callChannel ||
                typeof msg.content === "string"
              ) {
                try {
                  const contentObj = JSON.parse(msg.content);
                  if (contentObj && typeof contentObj === "object") {
                    if (contentObj.action) callAction = contentObj.action;
                    if (contentObj.duration != null)
                      callDuration = String(contentObj.duration);
                    if (contentObj.callType) callType = contentObj.callType;
                    if (contentObj.channel) callChannel = contentObj.channel;
                  }
                } catch {}
              }

              // Use content-based key with timestamp in 2-second window to match log/server messages
              // This allows log and server messages of the same call to match
              // But different calls (different durations or times > 2s apart) won't match
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 2000);
              customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
            } else if (msg.messageType === "products") {
              // For products, extract products array (handle both array and stringified formats)
              let productsArray = [];
              if (Array.isArray(msg.products)) {
                productsArray = msg.products;
              } else if (typeof msg.products === "string") {
                try {
                  const parsed = JSON.parse(msg.products);
                  productsArray = Array.isArray(parsed) ? parsed : [];
                } catch {
                  productsArray = [];
                }
              }
              // Use timestamp-based matching to allow multiple sends
              let productKey = "";
              if (productsArray.length > 0) {
                productKey =
                  productsArray[0]?.action_id || productsArray[0]?.title || "";
              }
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
              customKey = productKey
                ? `${productKey}-${timestampSeconds}`
                : `products-${timestampSeconds}`;
            }

            // If customKey is still empty, try to extract from content JSON
            if (!customKey && typeof msg.content === "string") {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (msg.messageType === "image" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "audio" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "file" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "call") {
                    // For call messages from content, use content-based matching
                    const callAction = contentObj.action || "";
                    const callDuration =
                      contentObj.duration != null
                        ? String(contentObj.duration)
                        : "";
                    const callType = contentObj.callType || "video";
                    const callChannel = contentObj.channel || "";
                    // Use content-based key with 2-second timestamp window
                    const createdAt = msg.createdAt
                      ? new Date(msg.createdAt)
                      : new Date();
                    const timestampSeconds = Math.floor(
                      createdAt.getTime() / 2000
                    );
                    customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                  } else if (msg.messageType === "products") {
                    // Handle both array and stringified products formats
                    let productsArray = [];
                    if (Array.isArray(contentObj.products)) {
                      productsArray = contentObj.products;
                    } else if (typeof contentObj.products === "string") {
                      try {
                        const parsed = JSON.parse(contentObj.products);
                        productsArray = Array.isArray(parsed) ? parsed : [];
                      } catch {
                        productsArray = [];
                      }
                    }
                    // Use timestamp-based matching to allow multiple sends
                    let productKey = "";
                    if (productsArray.length > 0) {
                      productKey =
                        productsArray[0]?.action_id ||
                        productsArray[0]?.title ||
                        "";
                    }
                    const createdAt = msg.createdAt
                      ? new Date(msg.createdAt)
                      : new Date();
                    const timestampSeconds = Math.floor(
                      createdAt.getTime() / 1000
                    );
                    customKey = productKey
                      ? `${productKey}-${timestampSeconds}`
                      : `products-${timestampSeconds}`;
                  }
                }
              } catch {
                // Not JSON, ignore
              }
            }

            if (customKey) {
              // For call messages, don't use timeWindow since customKey already includes timestamp
              // Use only messageType, customKey, and sender
              if (
                msg.messageType === "call" ||
                msg.messageType === "video_call" ||
                msg.messageType === "voice_call"
              ) {
                // Use the new format type for matching
                const matchType =
                  msg.messageType === "call"
                    ? msg.callType === "audio"
                      ? "voice_call"
                      : "video_call"
                    : msg.messageType;
                return `${matchType}-${customKey}-${msg.sender}`;
              }
              return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
            }

            // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
            if (msg.messageType === "system" && msg.system) {
              // Use a more granular timestamp (1-second window) to allow multiple system messages
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
              const systemKind = msg.system.kind || "";
              // For new_nutritionist messages, include action_type to differentiate coach_assigned vs coach_details
              if (
                systemKind === "new_nutritionist" &&
                msg.system.payload?.action_type
              ) {
                const actionType = msg.system.payload.action_type;
                return `${msg.messageType}-${systemKind}-${actionType}-${msg.sender}-${timestampSeconds}`;
              }
              return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
            }

            // For new message types (general_notification, video_call, voice_call, documents)
            // Use timestamp-based matching to allow both sent and received versions
            if (
              msg.messageType === "general_notification" ||
              msg.messageType === "video_call" ||
              msg.messageType === "voice_call" ||
              msg.messageType === "documents"
            ) {
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
              // Include sender to differentiate between sent and received
              return `${msg.messageType}-${msg.sender}-${timestampSeconds}`;
            }
          }

          // Text: align with logs-effect keys (server ids, else 1s bucket for log↔server merge)
          if (msg.messageType === "text" || !msg.messageType) {
            if (msg.serverMsgId) {
              return `txt:${msg.serverMsgId}`;
            }
            if (msg.mid) {
              return `txt:${msg.mid}`;
            }
            if (
              msg.id &&
              !msg.id.startsWith("outgoing-") &&
              !msg.id.startsWith("incoming-")
            ) {
              return `txt:${msg.id}`;
            }
            const createdAt = msg.createdAt ? new Date(msg.createdAt) : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
            return `${normalizedContent}-${msg.sender}-${timestampSeconds}`;
          }

          // Fallback to content-based matching for other messages
          return `${normalizedContent}-${msg.sender}-${timeWindow}`;
        };

        const serverMessagesByKey = new Map();
        newFetchedMessages.forEach((msg: Message) => {
          const key = createMatchKey(msg);
          if (!serverMessagesByKey.has(key)) {
            serverMessagesByKey.set(key, msg);
          }
        });

        // Track which server messages have been matched
        const matchedServerMessageIds = new Set();

        // Replace log messages with server messages if they match
        const updatedExistingMessages = existingMessages.map((logMsg) => {
          // Only try to match messages from logs (have generated IDs)
          if (
            logMsg.id.startsWith("outgoing-") ||
            logMsg.id.startsWith("incoming-")
          ) {
            const key = createMatchKey(logMsg);
            const serverMsg = serverMessagesByKey.get(key);
            if (serverMsg) {
              // Mark this server message as matched
              matchedServerMessageIds.add(serverMsg.id);
              // Use server message (has correct timestamp) instead of log message
              return serverMsg;
            }
          }
          return logMsg;
        });

        // Remove matched server messages from newFetchedMessages to prevent duplicates
        const unmatchedFetchedMessages = newFetchedMessages.filter(
          (msg: Message) => !matchedServerMessageIds.has(msg.id)
        );

        // Merge: keep updated existing messages + add only unmatched fetched ones
        // First, collect all server messages and their match keys
        const allMessagesTemp = [
          ...updatedExistingMessages,
          ...unmatchedFetchedMessages,
        ].filter((msg) => msg !== null && msg.createdAt); // Filter out null messages and messages without createdAt

        const serverMessageKeys = new Set();
        allMessagesTemp.forEach((msg) => {
          const isServerMsg =
            !msg.id.startsWith("outgoing-") && !msg.id.startsWith("incoming-");
          if (isServerMsg) {
            const key = createMatchKey(msg);
            serverMessageKeys.add(key);
          }
        });

        // Combine and sort by timestamp to maintain chronological order
        const allMessages = allMessagesTemp
          .filter((msg, index, self) => {
            // Remove duplicates by ID (first check)
            const idIndex = self.findIndex((m) => m.id === msg.id);
            if (idIndex !== index) {
              return false;
            }
            // Also check by match key to catch any remaining duplicates
            const key = createMatchKey(msg);
            const isLogMsg =
              msg.id.startsWith("outgoing-") || msg.id.startsWith("incoming-");

            // If this is a log message and we have a server message with the same key, filter it out
            if (isLogMsg && serverMessageKeys.has(key)) {
              return false;
            }

            // Remove other duplicates by match key (keep first occurrence)
            const keyIndex = self.findIndex((m) => createMatchKey(m) === key);
            if (keyIndex !== index) {
              return false;
            }

            return true;
          })
          .sort((a, b) => {
            const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
            const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
            return aDate.getTime() - bDate.getTime();
          });

        // Return merged messages along with messages from other peers
        const otherPeerMessages = prev.filter((msg) => msg.peerId !== peerId);
        const finalMessages = [...otherPeerMessages, ...allMessages];

        return finalMessages;
      });

      // Mark all loaded message IDs as processed to prevent polling from processing them again
      // Include both primary IDs and fallback ID formats (from-time) to match polling logic
      if (onMessagesLoadedFromHistory && oldMessages.length > 0) {
        const messageIds = new Set<string>();

        // Add all possible ID formats from original Agora messages (before filtering)
        // This ensures we catch all messages, even if they were filtered out later
        oldMessages.forEach((agoraMsg) => {
          // Primary ID formats
          if (agoraMsg.id) {
            messageIds.add(agoraMsg.id);
          }
          if (agoraMsg.mid) {
            messageIds.add(agoraMsg.mid);
          }
          // Fallback format: `${from}-${time}` (matches polling mechanism)
          if (agoraMsg.from && agoraMsg.time) {
            // Convert time to seconds if it's in milliseconds
            const timeInSeconds =
              agoraMsg.time > 1000000000000
                ? Math.floor(agoraMsg.time / 1000)
                : agoraMsg.time;
            messageIds.add(`${agoraMsg.from}-${timeInSeconds}`);
          }
        });

        // Also add formatted message IDs (in case formatMessage generates different IDs)
        deduplicatedFormatted.forEach((msg) => {
          if (msg.id) {
            messageIds.add(msg.id);
          }
        });

        if (messageIds.size > 0) {
          onMessagesLoadedFromHistory(Array.from(messageIds));
        }
      }

      // Scroll to bottom after initial messages are loaded
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    } catch (err) {
      console.error("fetchInitialMessages:", err);
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const fetchMoreMessages = async (): Promise<void> => {
    if (!peerId || !groupId || isFetchingHistory || !hasMore) return;

    const loadMoreAgora =
      !agoraHistoryExhaustedRef.current &&
      agoraHistoryCursorRef.current !== null;

    if (loadMoreAgora && !chatClient) {
      return;
    }

    try {
      setIsFetchingHistory(true);

      const chatArea = chatAreaRef.current;
      const prevScrollHeight = chatArea?.scrollHeight || 0;
      const prevScrollTop = chatArea?.scrollTop || 0;

      const conversationId = peerId.startsWith("user_")
        ? peerId
        : `user_${peerId}`;

      const pageSizeMore = 20;
      let newMessages: AgoraMessage[] = [];
      let nextDbCursor: string | undefined;
      /** True when this scroll already requested DB right after Agora exhausted (skip duplicate DB fetch). */
      let chainedDbAfterAgora = false;

      if (loadMoreAgora && chatClient) {
        const client = chatClient as Connection & {
          getHistoryMessages?: (options: {
            targetId: string;
            chatType: string;
            pageSize: number;
            searchDirection: string;
            cursor?: string;
          }) => Promise<{
            messages?: unknown[];
            cursor?: string;
            isLast?: boolean;
          }>;
        };

        const runBackendOlderPage = async (): Promise<void> => {
          const boundaryMs = minAgoraTimeMsRef.current;
          const apiUrl = new URL(config.api.fetchMessages);
          apiUrl.searchParams.append("conversationId", conversationId);
          apiUrl.searchParams.append("limit", String(pageSizeMore));
          if (boundaryMs !== undefined) {
            apiUrl.searchParams.append("cursor", String(boundaryMs));
            apiUrl.searchParams.append("from", String(boundaryMs));
          }
          const response = await fetch(apiUrl.toString());
          if (!response.ok) return;
          const apiRes: {
            messages?: ApiMessage[];
            nextCursor?: string;
          } = await response.json();
          const apiMessages = apiRes?.messages || [];
          nextDbCursor = apiRes?.nextCursor;
          const convertedApi = apiMessages
            .map((msg: unknown) =>
              convertApiMessageToFormat(msg as ApiMessage)
            )
            .filter(
              (msg: AgoraMessage | null): msg is AgoraMessage =>
                msg !== null
            );
          newMessages.push(...convertedApi);
        };

        let agoraRes: {
          messages?: unknown[];
          cursor?: string;
          isLast?: boolean;
        } | null = null;
        try {
          agoraRes = client.getHistoryMessages
            ? await client.getHistoryMessages({
                targetId: groupId,
                chatType: "groupChat",
                pageSize: pageSizeMore,
                searchDirection: "up",
                cursor: String(agoraHistoryCursorRef.current),
              })
            : { messages: [], cursor: undefined };
        } catch (e) {
          console.warn(
            "Agora getHistoryMessages failed, using backend history",
            e
          );
          agoraHistoryExhaustedRef.current = true;
          agoraHistoryCursorRef.current = null;
          chainedDbAfterAgora = true;
          await runBackendOlderPage();
          agoraRes = null;
        }

        if (agoraRes) {
          const batch = (agoraRes.messages || []) as AgoraMessage[];

          const bm = minAgoraMessageTimeMs(batch);
          if (bm !== undefined) {
            minAgoraTimeMsRef.current =
              minAgoraTimeMsRef.current === undefined
                ? bm
                : Math.min(minAgoraTimeMsRef.current, bm);
          }

          const noMoreAgora =
            batch.length === 0 || !agoraRes.cursor || agoraRes.isLast;

          if (noMoreAgora) {
            chainedDbAfterAgora = true;
            agoraHistoryExhaustedRef.current = true;
            agoraHistoryCursorRef.current = null;
            newMessages.push(...batch);
            await runBackendOlderPage();
          } else {
            agoraHistoryCursorRef.current = String(agoraRes.cursor);
            newMessages.push(...batch);
          }
        }
      }

      const shouldFetchDbOnly =
        agoraHistoryExhaustedRef.current &&
        !chainedDbAfterAgora &&
        (!loadMoreAgora || newMessages.length === 0);

      if (shouldFetchDbOnly) {
        const apiUrl = new URL(config.api.fetchMessages);
        apiUrl.searchParams.append("conversationId", conversationId);
        apiUrl.searchParams.append("limit", String(pageSizeMore));
        if (cursor) {
          apiUrl.searchParams.append("cursor", String(cursor));
        }

        const response = await fetch(apiUrl.toString());
        if (!response.ok) {
          setIsFetchingHistory(false);
          return;
        }

        const apiRes: {
          messages?: ApiMessage[];
          nextCursor?: string;
        } = await response.json();

        const apiMessages = apiRes?.messages || [];
        nextDbCursor = apiRes?.nextCursor;

        const convertedApiMessages = apiMessages
          .map((msg: unknown) => convertApiMessageToFormat(msg as ApiMessage))
          .filter(
            (msg: AgoraMessage | null): msg is AgoraMessage => msg !== null
          );

        newMessages = convertedApiMessages;
      }

      if (newMessages.length === 0) {
        setHasMore(false);
        setIsFetchingHistory(false);
        return;
      }

      const stillMoreAgora =
        !agoraHistoryExhaustedRef.current &&
        agoraHistoryCursorRef.current !== null;

      if (stillMoreAgora) {
        setHasMore(true);
      } else {
        if (nextDbCursor) {
          setCursor(nextDbCursor);
          setHasMore(true);
        } else {
          setCursor(null);
          setHasMore(false);
        }
      }

      // Filter out null messages (healthCoachChanged, mealPlanUpdate, etc.)
      const convertedMessages = newMessages.filter(
        (msg: AgoraMessage | null): msg is AgoraMessage => msg !== null
      );
      const formatted = convertedMessages
        .map((msg: AgoraMessage) =>
          formatMessage(msg, userId, peerId || "", selectedContact, coachInfo)
        )
        .filter((msg: Message | null): msg is Message => msg !== null); // Filter out null messages (hidden call initiate messages, etc.)

      // 🟢 DEDUPLICATE messages by ID: Filter out duplicates from both Agora and API
      // This prevents the same message from appearing twice when fetched from both sources
      const seenMessageIds = new Set<string>();
      const deduplicatedFormatted = formatted.filter((msg: Message) => {
        // Use message ID for deduplication
        if (msg.id) {
          if (seenMessageIds.has(msg.id)) {
            return false; // Filter out duplicate
          }
          seenMessageIds.add(msg.id);
        }

        // Also deduplicate products messages by product IDs (existing logic)
        if (msg.messageType === "products" && msg.products) {
          // Extract first product ID for deduplication key
          let firstProductId = "";
          if (Array.isArray(msg.products)) {
            firstProductId = msg.products[0]?.id || "";
          } else if (typeof msg.products === "string") {
            try {
              const parsed = JSON.parse(msg.products);
              if (Array.isArray(parsed) && parsed[0]?.id) {
                firstProductId = parsed[0].id;
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (firstProductId) {
            const key = `products-${firstProductId}-${msg.sender}`;
            if (seenMessageIds.has(key)) {
              return false; // Filter out duplicate
            }
            seenMessageIds.add(key);
          }
        }
        return true; // Keep all messages that pass deduplication
      });

      // 🟡 Prevent scroll-to-bottom behavior
      isLoadingHistoryRef.current = true;
      skipAutoScrollRef.current = true;

      setMessages((prev) => {
        const existing = prev.filter((msg) => msg.peerId === peerId);
        const existingIds = new Set(existing.map((m) => m.id));

        // Use the same matching logic as initial fetch
        const normalizeContent = (
          content: string | null | undefined
        ): string => {
          if (!content) return "";
          try {
            const parsed = JSON.parse(content);
            return JSON.stringify(parsed);
          } catch {
            return String(content).trim();
          }
        };

        const createMatchKey = (msg: Message): string => {
          const normalizedContent = normalizeContent(msg.content);
          const createdAt = msg.createdAt
            ? new Date(msg.createdAt)
            : new Date();
          const timeWindow = Math.floor(createdAt.getTime() / 300000);

          if (msg.messageType && msg.messageType !== "text") {
            let customKey = "";

            // Try to extract from message fields first
            if (msg.messageType === "image" && msg.imageUrl) {
              customKey = msg.imageUrl;
            } else if (msg.messageType === "audio" && msg.audioUrl) {
              customKey = msg.audioUrl;
            } else if (msg.messageType === "file" && msg.fileUrl) {
              customKey = msg.fileUrl;
            } else if (msg.messageType === "call") {
              // For call messages, use content-based matching (not ID) so log and server messages match
              // Extract action and duration from message object or content
              let callAction = msg.callAction || "";
              let callDuration =
                msg.callDurationSeconds != null
                  ? String(msg.callDurationSeconds)
                  : "";
              let callType = msg.callType || "video";
              let callChannel = msg.channel || "";

              // If fields not on message object, try to extract from content
              if (
                !callAction ||
                !callChannel ||
                typeof msg.content === "string"
              ) {
                try {
                  const contentObj = JSON.parse(msg.content);
                  if (contentObj && typeof contentObj === "object") {
                    if (contentObj.action) callAction = contentObj.action;
                    if (contentObj.duration != null)
                      callDuration = String(contentObj.duration);
                    if (contentObj.callType) callType = contentObj.callType;
                    if (contentObj.channel) callChannel = contentObj.channel;
                  }
                } catch {}
              }

              // Use content-based key with timestamp in 2-second window to match log/server messages
              // This allows log and server messages of the same call to match
              // But different calls (different durations or times > 2s apart) won't match
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 2000);
              customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
            } else if (msg.messageType === "products" && msg.products) {
              customKey = msg.products[0]?.id || "";
            }

            // If customKey is still empty, try to extract from content JSON
            if (!customKey && typeof msg.content === "string") {
              try {
                const contentObj = JSON.parse(msg.content);
                if (contentObj && typeof contentObj === "object") {
                  if (msg.messageType === "image" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "audio" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "file" && contentObj.url) {
                    customKey = contentObj.url;
                  } else if (msg.messageType === "call") {
                    // For call messages from content, use content-based matching
                    const callAction = contentObj.action || "";
                    const callDuration =
                      contentObj.duration != null
                        ? String(contentObj.duration)
                        : "";
                    const callType = contentObj.callType || "video";
                    const callChannel = contentObj.channel || "";
                    // Use content-based key with 2-second timestamp window
                    const createdAt = msg.createdAt
                      ? new Date(msg.createdAt)
                      : new Date();
                    const timestampSeconds = Math.floor(
                      createdAt.getTime() / 2000
                    );
                    customKey = `${callType}-${callChannel}-${callAction}-${callDuration}-${timestampSeconds}`;
                  } else if (msg.messageType === "products") {
                    // Handle both array and stringified products formats
                    let productsArray = [];
                    if (Array.isArray(contentObj.products)) {
                      productsArray = contentObj.products;
                    } else if (typeof contentObj.products === "string") {
                      try {
                        const parsed = JSON.parse(contentObj.products);
                        productsArray = Array.isArray(parsed) ? parsed : [];
                      } catch {
                        productsArray = [];
                      }
                    }
                    // Use timestamp-based matching to allow multiple sends
                    let productKey = "";
                    if (productsArray.length > 0) {
                      productKey =
                        productsArray[0]?.action_id ||
                        productsArray[0]?.title ||
                        "";
                    }
                    const createdAt = msg.createdAt
                      ? new Date(msg.createdAt)
                      : new Date();
                    const timestampSeconds = Math.floor(
                      createdAt.getTime() / 1000
                    );
                    customKey = productKey
                      ? `${productKey}-${timestampSeconds}`
                      : `products-${timestampSeconds}`;
                  }
                }
              } catch {
                // Not JSON, ignore
              }
            }

            if (customKey) {
              // For call messages, don't use timeWindow since customKey already includes timestamp
              // Use only messageType, customKey, and sender
              if (
                msg.messageType === "call" ||
                msg.messageType === "video_call" ||
                msg.messageType === "voice_call"
              ) {
                // Use the new format type for matching
                const matchType =
                  msg.messageType === "call"
                    ? msg.callType === "audio"
                      ? "voice_call"
                      : "video_call"
                    : msg.messageType;
                return `${matchType}-${customKey}-${msg.sender}`;
              }
              return `${msg.messageType}-${customKey}-${msg.sender}-${timeWindow}`;
            }

            // For system messages (meal_plan_updated, new_nutritionist, etc.), use timestamp to allow duplicates
            if (msg.messageType === "system" && msg.system) {
              // Use a more granular timestamp (1-second window) to allow multiple system messages
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
              const systemKind = msg.system.kind || "";
              // For new_nutritionist messages, include action_type to differentiate coach_assigned vs coach_details
              if (
                systemKind === "new_nutritionist" &&
                msg.system.payload?.action_type
              ) {
                const actionType = msg.system.payload.action_type;
                return `${msg.messageType}-${systemKind}-${actionType}-${msg.sender}-${timestampSeconds}`;
              }
              return `${msg.messageType}-${systemKind}-${msg.sender}-${timestampSeconds}`;
            }

            // For new message types (general_notification, video_call, voice_call, documents)
            // Use timestamp-based matching to allow both sent and received versions
            if (
              msg.messageType === "general_notification" ||
              msg.messageType === "video_call" ||
              msg.messageType === "voice_call" ||
              msg.messageType === "documents"
            ) {
              const createdAt = msg.createdAt
                ? new Date(msg.createdAt)
                : new Date();
              const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
              // Include sender to differentiate between sent and received
              return `${msg.messageType}-${msg.sender}-${timestampSeconds}`;
            }
          }

          // Text: server ids when present (matches logs / initial fetch keys)
          if (msg.messageType === "text" || !msg.messageType) {
            if (msg.serverMsgId) {
              return `txt:${msg.serverMsgId}`;
            }
            if (msg.mid) {
              return `txt:${msg.mid}`;
            }
            if (
              msg.id &&
              !msg.id.startsWith("outgoing-") &&
              !msg.id.startsWith("incoming-")
            ) {
              return `txt:${msg.id}`;
            }
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const timestampSeconds = Math.floor(createdAt.getTime() / 1000);
            return `${normalizedContent}-${msg.sender}-${timestampSeconds}`;
          }

          // Fallback to content-based matching for other messages
          return `${normalizedContent}-${msg.sender}-${timeWindow}`;
        };

        const existingMessagesByKey = new Map();
        existing.forEach((msg) => {
          const key = createMatchKey(msg);
          if (!existingMessagesByKey.has(key)) {
            existingMessagesByKey.set(key, msg);
          }
        });

        // Filter by both ID and content/key matching
        const unique = deduplicatedFormatted.reverse().filter((m: Message) => {
          if (existingIds.has(m.id)) {
            return false;
          }
          const key = createMatchKey(m);
          return !existingMessagesByKey.has(key);
        });

        return [...unique, ...prev];
      });

      // 🧭 Maintain exact scroll position when loading more messages
      requestAnimationFrame(() => {
        if (!chatArea) return;
        const newScrollHeight = chatArea.scrollHeight || 0;
        chatArea.scrollTop =
          newScrollHeight - (prevScrollHeight - prevScrollTop);
        // Delay resetting the flags until the next repaint
        setTimeout(() => {
          isLoadingHistoryRef.current = false;
          skipAutoScrollRef.current = false;
        }, 200);
      });
    } catch (err) {
      console.error("Error fetching more messages:", err);
      isLoadingHistoryRef.current = false;
      skipAutoScrollRef.current = false;
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);

  const handleScheduleClick = (): void => {
    setShowScheduleModal(true);
  };

  const handleSchedule = (
    date: Date,
    time: string,
    topics: string[],
    callType: "video" | "audio"
  ): void => {
    if (onSchedule) {
      onSchedule(date, time, topics.join(", "), callType);
    }
    setShowScheduleModal(false);
  };

  // Find the most recent scheduled call message
  const getScheduledCall = (): Message | null => {
    // First, check if we have a scheduled call from API with valid data
    if (
      scheduledCallFromApi &&
      scheduledCallFromApi.call_date_time &&
      scheduledCallFromApi.date &&
      scheduledCallFromApi.start_time
    ) {
      const scheduledDate = new Date(
        scheduledCallFromApi.call_date_time * 1000
      );
      const now = new Date();

      // Show if scheduled time is in the future (don't filter by one hour ago, show all future calls)
      if (scheduledDate > now) {
        return {
          id: `api-scheduled-${scheduledCallFromApi.call_date_time}`,
          sender: userId || "",
          isIncoming: false,
          content: JSON.stringify({
            type: "call_scheduled",
            time: scheduledCallFromApi.call_date_time,
          }),
          messageType: "call_scheduled",
          timestamp: scheduledDate.toISOString(),
          peerId: peerId || "",
          system: {
            kind: "call_scheduled",
            payload: {
              time: scheduledCallFromApi.call_date_time,
            },
          },
        };
      }
    }

    // No fallback to messages - only use scheduledCallFromApi as single source of truth
    return null;
  };

  // Memoize scheduledCall to ensure it updates immediately when scheduledCallFromApi changes
  const scheduledCall = useMemo(() => {
    return getScheduledCall();
  }, [scheduledCallFromApi, messages, userId, peerId]);

  // Handle cancel call
  const handleCancelCall = async (): Promise<void> => {
    if (!scheduledCallFromApi?.schedule_call_id) {
      console.error("No schedule_call_id available to cancel call");
      return;
    }

    try {
      await cancelCallWithDietitian(scheduledCallFromApi.schedule_call_id);

      if (peerId && groupId && scheduledCallFromApi.call_date_time) {
        try {
          await sendCustomMessage({
            from: userId,
            groupId,
            targetUserId: dietitianId,
            isFromUser: false,
            receiverId: dietitianId,
            type: "scheduled_call_canceled",
            data: {
              type: "scheduled_call_canceled",
              time: scheduledCallFromApi.call_date_time,
            },
          });
        } catch (error) {
          console.error(
            "Error sending scheduled call canceled custom message:",
            error
          );
        }
      }

      // Refresh the scheduled call data to update the UI
      if (onRefreshScheduledCall) {
        await onRefreshScheduledCall();
      }
    } catch (error) {
      // You might want to show an error message to the user here
    }
  };

  // Determine if banner should be shown (show if scheduled time is in the future)
  const shouldShowBanner = (): boolean => {
    if (
      scheduledCall &&
      scheduledCall.system?.payload?.time &&
      typeof scheduledCall.system.payload.time === "number"
    ) {
      const scheduledTime = scheduledCall.system.payload.time as number;
      const scheduledDate = new Date(scheduledTime * 1000);
      const now = new Date();

      // Show banner if scheduled time is in the future
      return scheduledDate > now;
    }
    return false;
  };

  const isBannerVisible = shouldShowBanner();
  const showScheduledBanner =
    isBannerVisible && !imageViewerUrl && !videoPlayerUrl;

  const voiceRecordingActive = isRecording || isRecordingStopped;

  return (
    <div
      className={`chat-interface${voiceRecordingActive ? " voice-recording-active" : ""}`}
      style={{ position: "relative" }}
    >
      <FPChatHeader
        selectedContact={selectedContact}
        onBackToConversations={onBackToConversations}
        onScheduleClick={handleScheduleClick}
        onProfileClick={() => setShowProfileModal(true)}
      />
      {showScheduledBanner && (
        <FPScheduledCallBanner
          scheduledCall={scheduledCall!}
          onClick={
            onInitiateCall && scheduledCallFromApi
              ? () => {
                  const callType = scheduledCallFromApi.call_type || "video";
                  onInitiateCall(callType);
                }
              : undefined
          }
        />
      )}
      {/* Chat Area */}
      <div
        className={`chat-area ${showScheduledBanner ? "has-banner" : ""}`}
        ref={chatAreaRef}
      >
        {isFetchingHistory && (
          <div
            style={{
              position: "sticky",
              top: 0,
              background: "white",
              zIndex: 10,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "8px",
              color: "#6b7280",
              fontSize: "0.85rem",
            }}
          >
            <div
              className="spinner"
              style={{
                width: "18px",
                height: "18px",
                border: "2px solid #d1d5db",
                borderTop: "2px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginRight: "8px",
              }}
            ></div>
            Loading older messages...
          </div>
        )}

        <FPChatTab
          peerId={peerId || ""}
          currentConversationMessages={currentConversationMessages}
          formatDateLabel={formatDateLabel}
          formatCurrency={formatCurrency}
          openImageViewer={openImageViewer}
          currentlyPlayingAudioRef={currentlyPlayingAudioRef}
          onPlayVideo={openVideoPlayer}
          hasScheduledCallBanner={showScheduledBanner}
        />
      </div>

      {/* Message Input - Hidden when viewing image/video or during voice record/preview */}
      {!imageViewerUrl &&
        !videoPlayerUrl &&
        !voiceRecordingActive && (
      <div className="message-input-area">
        <FPDraftAttachmentPreview
          draftAttachment={draftAttachment}
          onRemove={clearDraftAttachment}
          onImageClick={openImageViewer}
          formatDuration={formatDuration}
          currentlyPlayingAudioRef={currentlyPlayingAudioRef}
        />

        <FPMessageInput
          message={message}
          setMessage={
            setMessage as (msg: string | ((prev: string) => string)) => void
          }
          draftAttachment={draftAttachment}
          getDraftCaption={getDraftCaption}
          selectedContact={selectedContact}
          isRecording={isRecording}
          peerId={peerId || ""}
          inputResetKey={inputResetKey}
          onSend={handleSendMessage}
          onKeyPress={handleKeyPress}
          onStartAudioRecording={startAudioRecording}
          onToggleMediaPopup={() => setShowMediaPopup(!showMediaPopup)}
          onToggleEmojiPicker={toggleEmojiPicker}
          showEmojiPicker={showEmojiPicker}
          audioBtnRef={audioBtnRef as React.RefObject<HTMLButtonElement>}
          inputRef={inputRef as React.RefObject<HTMLInputElement>}
          emojiPickerRef={emojiPickerRef as React.RefObject<HTMLDivElement>}
        />
      </div>
      )}

      {/* Media Upload Popup */}
      <FPMediaPopup
        showMediaPopup={showMediaPopup}
        onSelect={handleMediaSelect}
        onClose={() => setShowMediaPopup(false)}
        message={message}
        setMessage={
          setMessage as (msg: string | ((prev: string) => string)) => void
        }
        draftAttachment={draftAttachment}
        getDraftCaption={getDraftCaption}
        selectedContact={selectedContact}
        isRecording={isRecording}
        peerId={peerId || ""}
        inputResetKey={inputResetKey}
        onSend={handleSendMessage}
        onKeyPress={handleKeyPress}
        onStartAudioRecording={startAudioRecording}
        inputRef={inputRef as React.RefObject<HTMLInputElement>}
        audioBtnRef={audioBtnRef as React.RefObject<HTMLButtonElement>}
      />

      {/* Audio Recording Overlay */}
      <FPAudioRecordingOverlay
        isRecording={isRecording}
        isStopped={isRecordingStopped}
        recordingDuration={
          isRecordingStopped ? stoppedRecordingDuration : recordingDuration
        }
        mediaStream={recordingStreamForViz}
        onCancel={cancelAudioRecording}
        onStop={stopAudioRecording}
        onSend={sendStoppedRecording}
        formatDuration={formatDuration}
      />

      {/* Camera Capture Overlay */}
      <FPCameraCaptureOverlay
        showCameraCapture={showCameraCapture}
        videoRef={videoRef as React.RefObject<HTMLVideoElement>}
        onClose={closeCamera}
        onCapture={capturePhoto}
        onFlipCamera={flipCamera}
        hasMultipleCameras={hasMultipleCameras}
      />

      {/* Fullscreen Image Viewer */}
      <FPImageViewer
        imageUrl={imageViewerUrl}
        imageAlt={imageViewerAlt}
        onClose={closeImageViewer}
      />

      {/* Video Player */}
      <FPVideoPlayer videoUrl={videoPlayerUrl} onClose={closeVideoPlayer} />

      {/* Audio Player for Voice Recordings */}
      <FPAudioPlayer audioUrl={audioPlayerUrl} onClose={closeAudioPlayer} />

      {/* Schedule Call Modal */}
      {selectedContact && (
        <FPScheduleCallModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSchedule={handleSchedule}
          selectedContact={selectedContact}
          userId={userId}
          dietitianId={dietitianId}
          groupId={groupId}
          scheduledCallFromApi={scheduledCallFromApi}
          onCancelCall={handleCancelCall}
        />
      )}

      {/* Profile Modal */}
      {selectedContact && (
        <FPProfileModal
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          selectedContact={selectedContact}
          scheduledCallFromApi={scheduledCallFromApi}
          onCancelCall={handleCancelCall}
          onScheduleCall={() => {
            setShowProfileModal(false);
            setShowScheduleModal(true);
          }}
        />
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileSelect}
        accept="*/*"
      />
      <input
        type="file"
        ref={photoInputRef}
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
        accept="image/*"
      />
      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: "none" }}
        onChange={handlePhotoSelect}
        accept="image/*"
        capture="environment"
      />
    </div>
  );
}
