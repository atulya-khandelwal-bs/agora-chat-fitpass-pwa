import { MoreVertical } from "lucide-react";
import SealCheck from "../assets/SealCheck.svg";
import type { Contact } from "../../common/types/chat";
import React from "react";
import config from "../../common/config.ts";

interface FPChatHeaderProps {
  selectedContact: Contact | null;
  onBackToConversations?: (() => void) | null;
  onScheduleClick?: (() => void) | null;
  onProfileClick?: (() => void) | null;
}

export default function FPChatHeader({
  selectedContact,
  onBackToConversations,
  onScheduleClick,
  onProfileClick,
}: FPChatHeaderProps): React.JSX.Element {
  return (
    <>
      {/* Header */}
      <div className="chat-header">
        {onBackToConversations && (
          <button
            className="back-btn"
            onClick={onBackToConversations}
            title="Back to conversations"
            style={{
              background: "none",
              border: "none",
              color: "var(--text)",
              cursor: "pointer",
              padding: "0.5rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: "0.5rem",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <div
          className="contact-info"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {/* Profile Picture */}
          {selectedContact && (
            <div
              onClick={onProfileClick || undefined}
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                overflow: "hidden",
                flexShrink: 0,
                cursor: onProfileClick ? "pointer" : "default",
              }}
            >
              <img
                src={selectedContact.avatar || config.defaults.avatar}
                alt={selectedContact.name}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== config.defaults.avatar) {
                    target.src = config.defaults.avatar;
                  } else {
                    // If default avatar also fails, hide the image
                    target.style.display = "none";
                  }
                }}
              />
            </div>
          )}
          {/* Name and Nutritionist Badge */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <h2
                onClick={onProfileClick || undefined}
                style={{
                  margin: 0,
                  fontSize: "16px",
                  fontWeight: 600,
                  textAlign: "left",
                  cursor: onProfileClick ? "pointer" : "default",
                }}
              >
                {selectedContact?.name || "Select a Contact"}
              </h2>
              {/* Seal Check Icon */}
              {selectedContact && (
                <img
                  src={SealCheck}
                  alt="Seal Check"
                  style={{
                    width: "16px",
                    height: "16px",
                  }}
                />
              )}
            </div>
            {/* Designation Label */}
            {selectedContact && (
              <p
                style={{
                  margin: 0,
                  fontSize: "12px",
                  color: "#6C7985",
                  fontWeight: 500,
                  textAlign: "left",
                }}
              >
                {selectedContact.description || "Nutritionist"}
              </p>
            )}
          </div>
        </div>
        {selectedContact && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {/* Three Dot Menu Icon */}
            <button
              title="More options"
              onClick={onScheduleClick || undefined}
              style={{
                background: "none",
                border: "none",
                color: "var(--text)",
                cursor: onScheduleClick ? "pointer" : "default",
                padding: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (onScheduleClick) {
                  e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.05)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <MoreVertical size={24} />
            </button>
            {/* Video Call Button
            {onInitiateCall && (
              <div
                ref={dropdownRef}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={toggleDropdown}
                  title="Start call"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text)",
                    cursor: "pointer",
                    padding: "0.5rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    transition: "background-color 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      "rgba(0, 0, 0, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Video size={24} />
                  <ChevronDown size={16} style={{ marginLeft: "4px" }} />
                </button>

                {showDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      right: 0,
                      marginTop: "0.5rem",
                      background: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow:
                        "0px 4px 6px -1px rgba(0, 0, 0, 0.1), 0px 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      minWidth: "160px",
                      zIndex: 1000,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      onClick={handleVideoCall}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        color: "#111827",
                        fontSize: "0.875rem",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#F3F4F6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Video size={20} style={{ color: "#000" }} />
                      <span>Video Call</span>
                    </button>
                    <button
                      onClick={handleVoiceCall}
                      style={{
                        width: "100%",
                        padding: "0.75rem 1rem",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        color: "#111827",
                        fontSize: "0.875rem",
                        borderTop: "1px solid #E5E7EB",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#F3F4F6";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <Phone size={20} style={{ color: "#000" }} />
                      <span>Voice Call</span>
                    </button>
                  </div>
                )}
              </div> 
            )}*/}
          </div>
        )}
      </div>
    </>
  );
}
