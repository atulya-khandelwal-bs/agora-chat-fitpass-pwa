import { RefObject } from "react";
import FPImageMessageView from "./messages/FPImageMessageView";
import FPAudioMessageView from "./messages/FPAudioMessageView";
import FPFileMessageView from "./messages/FPFileMessageView";
import FPProductMessageView from "./messages/FPProductMessageView";
import FPCallMessageView from "./messages/FPCallMessageView";
import FPTextMessageView from "./messages/FPTextMessageView";
import FPGeneralNotificationView from "./messages/FPGeneralNotificationView";
import FPCallScheduledView from "./messages/FPCallScheduledView";
import type { Message } from "../../common/types/chat";
import React from "react";

interface FPMessageBubbleProps {
  msg: Message;
  openImageViewer: (url: string, alt?: string) => void;
  currentlyPlayingAudioRef: RefObject<HTMLAudioElement | null>;
  formatCurrency: (amount: number) => string;
  onPlayVideo?: (
    videoUrl: string,
    callType?: "video_call" | "voice_call"
  ) => void;
  isLastMessage?: boolean;
  /** Vertical gap from the previous chat bubble: 4 same side, 12 when switching sides; 0 if not stacked */
  stackMarginTopPx?: number;
  /** Extra space below this row (e.g. recommended products uses 12px; pair with reduced top on the next row) */
  stackMarginBottomPx?: number;
}

export default function FPMessageBubble({
  msg,
  openImageViewer,
  currentlyPlayingAudioRef,
  formatCurrency,
  onPlayVideo,
  isLastMessage = false,
  stackMarginTopPx = 0,
  stackMarginBottomPx = 0,
}: FPMessageBubbleProps): React.JSX.Element {
  const renderMessageContent = (): React.JSX.Element => {
    if (msg.messageType === "image" && (msg.imageData || msg.imageUrl)) {
      return (
        <FPImageMessageView
          imageUrl={msg.imageData || msg.imageUrl || ""}
          fileName={msg.fileName}
          openImageViewer={openImageViewer}
        />
      );
    }

    if (msg.messageType === "audio" && msg.audioUrl) {
      return (
        <FPAudioMessageView
          audioUrl={msg.audioUrl}
          currentlyPlayingAudioRef={currentlyPlayingAudioRef}
          isIncoming={msg.isIncoming}
        />
      );
    }

    if (msg.messageType === "file" && (msg.fileUrl || msg.fileName)) {
      return (
        <FPFileMessageView
          fileUrl={msg.fileUrl}
          fileName={msg.fileName}
          fileMime={msg.fileMime}
          fileSizeBytes={msg.fileSizeBytes}
          fileSize={msg.fileSize}
          isIncoming={msg.isIncoming}
        />
      );
    }

    if (msg.messageType === "documents" && msg.system) {
      const payload = msg.system.payload as {
        title?: string;
        description?: string;
        icons_details?: {
          left_icon?: string;
          right_icon?: string;
        };
        documents_details?: {
          document_url?: string;
          document_size?: number;
          document_type?: string;
        };
        redirection_details?: Array<{
          cta_details?: {
            text?: string;
            text_color?: string;
            bg_color?: string;
          };
          redirect_url?: string;
          action_id?: string;
        }>;
      };

      // Use fileUrl/fileName from message if available, otherwise extract from system payload
      const documentUrl =
        msg.fileUrl || payload.documents_details?.document_url;
      const documentName = msg.fileName || payload.title;
      const documentMime =
        msg.fileMime || payload.documents_details?.document_type;
      const documentSize =
        msg.fileSizeBytes || payload.documents_details?.document_size;

      return (
        <FPFileMessageView
          fileUrl={documentUrl}
          fileName={documentName}
          fileMime={documentMime}
          fileSizeBytes={documentSize}
          isIncoming={msg.isIncoming}
          icons_details={payload.icons_details}
          redirection_details={payload.redirection_details}
        />
      );
    }

    if (msg.messageType === "products" && Array.isArray(msg.products)) {
      return (
        <FPProductMessageView
          products={msg.products}
          formatCurrency={formatCurrency}
        />
      );
    }

    // Handle both old "call" format and new "video_call"/"voice_call" format
    if (
      msg.messageType === "call" ||
      msg.messageType === "video_call" ||
      msg.messageType === "voice_call"
    ) {
      // Convert old "call" format to new format
      let callType: "video_call" | "voice_call";
      let title: string | undefined;
      let description: string | undefined;
      let icons_details:
        | { left_icon?: string; right_icon?: string }
        | undefined;
      let call_details: { call_url?: string } | undefined;

      if (msg.messageType === "call") {
        // Old format: convert to new format
        const oldCallType = msg.callType as "video" | "audio" | undefined;
        callType = oldCallType === "audio" ? "voice_call" : "video_call";
        title = oldCallType === "video" ? "Video call" : "Voice call";
        if (msg.callDurationSeconds != null) {
          const minutes = Math.floor(msg.callDurationSeconds / 60);
          const seconds = msg.callDurationSeconds % 60;
          description = `${minutes}:${String(seconds).padStart(2, "0")}`;
        }
      } else {
        // New format: extract from system payload
        callType = msg.messageType as "video_call" | "voice_call";
        if (msg.system) {
          const payload = msg.system.payload as {
            title?: string;
            description?: string;
            icons_details?: {
              left_icon?: string;
              right_icon?: string;
            };
            call_details?: {
              call_url?: string;
            };
          };
          title = payload.title;
          description = payload.description;
          icons_details = payload.icons_details;
          call_details = payload.call_details;
        }
      }

      return (
        <FPCallMessageView
          callType={callType}
          title={title}
          description={description}
          icons_details={icons_details}
          call_details={call_details}
          onPlayVideo={onPlayVideo}
        />
      );
    }

    if (
      (msg.messageType === "video_call" || msg.messageType === "voice_call") &&
      msg.system
    ) {
      const payload = msg.system.payload as {
        title?: string;
        description?: string;
        icons_details?: {
          left_icon?: string;
          right_icon?: string;
        };
        call_details?: {
          call_url?: string;
        };
        redirection_details?: Array<{
          cta_details?: {
            text?: string;
            text_color?: string;
            bg_color?: string;
          };
          redirect_url?: string;
          action_id?: string;
        }>;
      };

      return (
        <FPCallMessageView
          callType={msg.messageType as "video_call" | "voice_call"}
          title={payload.title}
          description={payload.description}
          icons_details={payload.icons_details}
          call_details={payload.call_details}
          redirection_details={payload.redirection_details}
          onPlayVideo={onPlayVideo}
        />
      );
    }

    if (
      msg.messageType === "call_scheduled" ||
      msg.messageType === "scheduled_call_canceled"
    ) {
      return <FPCallScheduledView msg={msg} />;
    }

    if (msg.messageType === "general_notification" && msg.system) {
      const payload = msg.system.payload as {
        title?: string;
        description?: string;
        redirection_details?:
          | Array<{
              cta_details?: {
                text?: string;
                text_color?: string;
                bg_color?: string;
              };
              redirect_url?: string;
              action_id?: string;
            }>
          | string;
      };

      // Parse redirection_details if it's a string
      let redirectionDetails: Array<{
        cta_details?: {
          text?: string;
          text_color?: string;
          bg_color?: string;
        };
        redirect_url?: string;
        action_id?: string;
      }> = [];

      if (payload.redirection_details) {
        if (typeof payload.redirection_details === "string") {
          try {
            redirectionDetails = JSON.parse(payload.redirection_details);
          } catch (e) {
            redirectionDetails = [];
          }
        } else if (Array.isArray(payload.redirection_details)) {
          redirectionDetails = payload.redirection_details;
        }
      }

      return (
        <FPGeneralNotificationView
          title={payload.title}
          description={payload.description}
          redirection_details={redirectionDetails}
        />
      );
    }

    // Fallback: try to parse JSON content for media
    try {
      if (
        typeof msg.content === "string" &&
        msg.content.trim().startsWith("{")
      ) {
        const obj = JSON.parse(msg.content) as {
          type?: string;
          url?: string;
          fileName?: string;
          mimeType?: string;
          size?: number;
          callType?: string;
          duration?: number;
          time?: number | string;
        };
        if (obj && typeof obj === "object" && obj.type) {
          const t = String(obj.type).toLowerCase();
          if (t === "image" && obj.url) {
            return (
              <FPImageMessageView
                imageUrl={obj.url}
                fileName={obj.fileName}
                openImageViewer={openImageViewer}
              />
            );
          }
          if (t === "file" && obj.url) {
            return (
              <FPFileMessageView
                fileUrl={obj.url}
                fileName={obj.fileName}
                fileMime={obj.mimeType}
                fileSizeBytes={obj.size}
                isIncoming={msg.isIncoming}
              />
            );
          }
          if (t === "call_scheduled" || t === "scheduled_call_canceled") {
            // Create a message object with the parsed data for FPCallScheduledView
            const callScheduledMsg: Message = {
              ...msg,
              messageType: t,
              system: {
                kind: t,
                payload: {
                  time:
                    typeof obj.time === "number"
                      ? obj.time
                      : typeof obj.time === "string"
                      ? parseInt(obj.time, 10)
                      : undefined,
                },
              },
            };
            return <FPCallScheduledView msg={callScheduledMsg} />;
          }
          if (t === "call") {
            // Convert old "call" format to new format
            const oldCallType = obj.callType as "video" | "audio" | undefined;
            const callType =
              oldCallType === "audio" ? "voice_call" : "video_call";
            const title = oldCallType === "video" ? "Video call" : "Voice call";
            let description: string | undefined;
            if (obj.duration != null) {
              const minutes = Math.floor(obj.duration / 60);
              const seconds = obj.duration % 60;
              description = `${minutes}:${String(seconds).padStart(2, "0")}`;
            }
            return (
              <FPCallMessageView
                callType={callType}
                title={title}
                description={description}
              />
            );
          }
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Default: render as text
    return <FPTextMessageView content={msg.content} />;
  };

  const wrapperStyle: React.CSSProperties | undefined =
    stackMarginTopPx || stackMarginBottomPx
      ? {
          ...(stackMarginTopPx ? { marginTop: stackMarginTopPx } : {}),
          ...(stackMarginBottomPx ? { marginBottom: stackMarginBottomPx } : {}),
        }
      : undefined;

  return (
    <div
      className={`message-wrapper ${msg.isIncoming ? "incoming" : "outgoing"}${msg.messageType === "products" ? " message-wrapper--products" : ""}`}
      style={wrapperStyle}
    >
      <div className="message-container">
        {msg.label && !msg.isIncoming && (
          <div className="message-label">{msg.label}</div>
        )}
        <div className="message-content">
          {!msg.isIncoming && msg.messageType !== "products" && (
            <div className="message-time">{msg.timestamp}</div>
        )}
        <div
          className={`message-bubble${msg.messageType === "products" ? " message-bubble--products" : ""}`}
          style={{
            position: "relative",
          }}
        >
          {renderMessageContent()}
          {isLastMessage && msg.messageType !== "products" && !msg.isIncoming && (
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                right: -8,
                bottom: -5,
                pointerEvents: "none",
              }}
            >
              <path
                d="M0 7.71777C0.5 11.1206 2 18 18 18C16.2251 17.2188 9 12.6373 9 0L0 7.71777Z"
                fill="#109310"
              />
            </svg>
          )}
          {isLastMessage && msg.messageType !== "products" && msg.isIncoming && (
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: "absolute",
                left: -8,
                bottom: -5,
                pointerEvents: "none",
              }}
            >
              <path
                d="M18 7.71777C17.5 11.1206 16 18 0 18C1.7749 17.2188 9 12.6373 9 0L18 7.71777Z"
                fill="#e5e7eb"
              />
            </svg>
          )}
        </div>
          {msg.isIncoming && msg.messageType !== "products" && (
        <div className="message-time">{msg.timestamp}</div>
          )}
        </div>
      </div>
    </div>
  );
}
