import React, { useEffect, RefObject, KeyboardEvent } from "react";
import { X, Mic, SendHorizontal } from "lucide-react";
import type { DraftAttachment, Contact } from "../../common/types/chat";

interface FPMediaPopupProps {
  showMediaPopup: boolean;
  onSelect: (type: "photos" | "camera" | "file") => void;
  onClose: () => void;
  // Input props - same as FPMessageInput
  message: string;
  setMessage: (message: string | ((prev: string) => string)) => void;
  draftAttachment: DraftAttachment | null;
  getDraftCaption: () => string;
  selectedContact: Contact | null;
  isRecording: boolean;
  peerId: string;
  inputResetKey: number;
  onSend: () => void;
  onKeyPress: (e: KeyboardEvent<HTMLInputElement>) => void;
  onStartAudioRecording: () => void;
  inputRef: RefObject<HTMLInputElement>;
  audioBtnRef: RefObject<HTMLButtonElement>;
}

export default function FPMediaPopup({
  showMediaPopup,
  onSelect,
  onClose,
  message,
  setMessage,
  draftAttachment,
  getDraftCaption,
  selectedContact,
  isRecording,
  peerId,
  inputResetKey,
  onSend,
  onKeyPress,
  onStartAudioRecording,
  inputRef,
  audioBtnRef,
}: FPMediaPopupProps): React.JSX.Element | null {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showMediaPopup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showMediaPopup]);

  if (!showMediaPopup) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Determine if we should show send icon or mic icon
  const hasText = typeof message === "string" ? message.trim() : message;
  const shouldShowSend = hasText || !!draftAttachment;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          zIndex: 9998,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={handleBackdropClick}
      />
      {/* Bottom Sheet Modal */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          background: "#FFFFFF",
          borderTopLeftRadius: "20px",
          borderTopRightRadius: "20px",
          zIndex: 9999,
          boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
          animation: "slideUp 0.3s ease-out",
          maxHeight: "80vh",
          overflowY: "auto",
          paddingTop: "1rem",
        }}
      >
        {/* Input Bar - Same styling as FPMessageInput but with X button */}
        <div className="input-container" style={{ background: "transparent" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "0.5rem",
        }}
      >
            {/* Close (X) Button - Red Circular (same style as Plus button) */}
        <div
          style={{
            display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
          }}
        >
          <button
                className="icon-btn close-btn"
            onClick={onClose}
                title="Close"
            style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "#DC4144",
              border: "none",
              cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#FFFFFF",
                  flexShrink: 0,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                <X size={20} color="#FFFFFF" strokeWidth={2.5} />
              </button>
            </div>

            {/* Input Field - Same styling as FPMessageInput */}
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                flexShrink: 1,
              }}
            >
              <input
                ref={inputRef}
                type="text"
                key={`${peerId}-${inputResetKey}`}
                placeholder={
                  draftAttachment && draftAttachment.type === "audio"
                    ? "Add a caption (optional)"
                    : draftAttachment
                    ? "Add a caption (optional)"
                    : "Write a message..."
                }
                value={
                  draftAttachment && draftAttachment.type !== "audio"
                    ? getDraftCaption()
                    : draftAttachment
                    ? ""
                    : typeof message === "string"
                    ? message
                    : ""
                }
                onChange={(e) => {
                  const text = e.target.value;
                  if (draftAttachment) {
                    try {
                      const obj = JSON.parse(message) as { caption?: string };
                      obj.caption = text;
                      setMessage(JSON.stringify(obj));
                    } catch {
                      setMessage(text);
                    }
                  } else {
                    setMessage(text);
                  }
                }}
                onInput={(e) => {
                  const text = (e.target as HTMLInputElement).value;
                  if (!draftAttachment && text !== message) {
                    setMessage(text);
                  }
                }}
                onKeyPress={onKeyPress}
                className="message-input"
                disabled={!selectedContact}
                style={{
                  width: "100%",
                  border: "none",
                  outline: "none",
                  padding: "0.75rem 1rem",
                  fontSize: "0.875rem",
                  background: "#F3F4F6",
                  borderRadius: "24px",
                  color: "#111827",
                }}
              />
            </div>

            {/* Send/Mic Icon Button - Same styling as FPMessageInput */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {shouldShowSend ? (
                <button
                  className="icon-btn send-icon-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSend();
                    onClose();
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  disabled={!selectedContact || (!draftAttachment && !hasText)}
                  title="Send message"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#DC4144",
                    border: "none",
                    cursor:
                      selectedContact && (draftAttachment || hasText)
                        ? "pointer"
                        : "not-allowed",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "opacity 0.2s",
                    color: "#FFFFFF",
                    opacity:
                      selectedContact && (draftAttachment || hasText) ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedContact && (draftAttachment || hasText)) {
                      e.currentTarget.style.opacity = "0.9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedContact && (draftAttachment || hasText)) {
                      e.currentTarget.style.opacity = "1";
                    }
                  }}
                >
                  {/* <Send size={20} color="#FFFFFF" strokeWidth={2.5} /> */}
                  <SendHorizontal size={20} />
                </button>
              ) : (
                <button
                  ref={audioBtnRef}
                  className="icon-btn mic-icon-btn"
                  disabled={!selectedContact || isRecording}
                  onClick={() => {
                    if (!isRecording) {
                      onClose();
                      onStartAudioRecording();
                    }
                  }}
                  title="Record audio"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    background: "#0A1F34",
                    border: "none",
                    cursor:
                      selectedContact && !isRecording
                        ? "pointer"
                        : "not-allowed",
                    padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
                    color: "#FFFFFF",
                    flexShrink: 0,
                    transition: "opacity 0.2s",
                    opacity: selectedContact && !isRecording ? 1 : 0.5,
                  }}
                  onMouseEnter={(e) => {
                    if (selectedContact && !isRecording) {
                      e.currentTarget.style.opacity = "0.9";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedContact && !isRecording) {
                      e.currentTarget.style.opacity = "1";
                    }
            }}
          >
                  <Mic size={20} color="#FFFFFF" strokeWidth={2.5} />
          </button>
              )}
            </div>
          </div>
        </div>

        {/* Media Options */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-around",
            alignItems: "center",
            gap: "2rem",
            padding: "1.5rem 1rem",
            paddingBottom: "2rem",
          }}
        >
          <button
            onClick={() => {
              onSelect("photos");
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem",
              borderRadius: "12px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#FEF3C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#F59E0B",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </div>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Photos
            </span>
          </button>

          <button
            onClick={() => {
              onSelect("camera");
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem",
              borderRadius: "12px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#DBEAFE",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#3B82F6",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </div>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              Camera
            </span>
          </button>

          <button
            onClick={() => {
              onSelect("file");
              onClose();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.5rem",
              borderRadius: "12px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.5)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                borderRadius: "50%",
                background: "#D1FAE5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10B981",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#111827",
              }}
            >
              File
            </span>
          </button>
        </div>
      </div>

      {/* CSS Animations */}
      <style>
        {`
          @keyframes slideUp {
            from {
              transform: translateY(100%);
            }
            to {
              transform: translateY(0);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
        `}
      </style>
    </>
  );
}
