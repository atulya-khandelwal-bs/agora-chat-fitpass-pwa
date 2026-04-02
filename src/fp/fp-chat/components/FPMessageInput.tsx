import React, { useEffect, RefObject, KeyboardEvent } from "react";
import { Plus, Mic, SendHorizonal } from "lucide-react";
import "emoji-picker-element";
import type { DraftAttachment, Contact } from "../../common/types/chat";

interface FPMessageInputProps {
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
  onToggleMediaPopup: () => void;
  onToggleEmojiPicker: () => void;
  showEmojiPicker: boolean;
  audioBtnRef: RefObject<HTMLButtonElement>;
  inputRef: RefObject<HTMLInputElement>;
  emojiPickerRef: RefObject<HTMLDivElement>;
}

export default function FPMessageInput({
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
  onToggleMediaPopup,
  onToggleEmojiPicker,
  showEmojiPicker,
  audioBtnRef,
  inputRef,
  emojiPickerRef,
}: FPMessageInputProps): React.JSX.Element {
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
      handleEmojiSelect = (event: Event) => {
        // Try different event structures
        const customEvent = event as CustomEvent;
        const emoji =
          customEvent.detail?.unicode ||
          (customEvent.detail as { emoji?: { unicode?: string } })?.emoji
            ?.unicode ||
          customEvent.detail ||
          (event as { emoji?: string }).emoji ||
          (event as { unicode?: string }).unicode;

        if (emoji && typeof emoji === "string") {
          setMessage((prev) => prev + emoji);
        }
      };

      // Try multiple event names that emoji-picker-element might use
      pickerElement.addEventListener("emoji-click", handleEmojiSelect);
      pickerElement.addEventListener("emojiClick", handleEmojiSelect);
      pickerElement.addEventListener("change", handleEmojiSelect);

      // Try to access shadow DOM for navigation styling
      const shadowRoot = (
        pickerElement as HTMLElement & { shadowRoot?: ShadowRoot }
      ).shadowRoot;
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
          const navElement = shadowRoot.querySelector(
            selector
          ) as HTMLElement | null;
          if (navElement) {
            navElement.style.overflowX = "auto";
            navElement.style.overflowY = "hidden";
            navElement.style.whiteSpace = "nowrap";
            navElement.style.display = "flex";
            navElement.style.scrollbarWidth = "thin";
            navElement.style.setProperty("-webkit-overflow-scrolling", "touch");
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
            (div as HTMLElement).style.overflowX = "auto";
            (div as HTMLElement).style.overflowY = "hidden";
            (div as HTMLElement).style.whiteSpace = "nowrap";
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
  }, [showEmojiPicker, setMessage, emojiPickerRef]);

  // 👉 Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        onToggleEmojiPicker();
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("click", handleClickOutside, true);
      return () =>
        document.removeEventListener("click", handleClickOutside, true);
    }
  }, [showEmojiPicker, emojiPickerRef, onToggleEmojiPicker]);

  // Determine if we should show send icon or mic icon
  const hasText = typeof message === "string" ? message.trim() : message;
  const shouldShowSend = hasText || !!draftAttachment;

  return (
    <div className="input-container">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "0.5rem",
        }}
      >
        {/* Plus Icon Button - Red Circular */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <button
            className="icon-btn plus-btn"
            disabled={!selectedContact}
            onClick={onToggleMediaPopup}
            title="Attach media"
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#DC4144",
              border: "none",
              cursor: selectedContact ? "pointer" : "not-allowed",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              flexShrink: 0,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              if (selectedContact) {
                e.currentTarget.style.opacity = "0.9";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          </button>
        </div>

        {/* Input Field - Light Grey Rounded */}
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

        {/* Send/Mic Icon Button - Dark Blue Circular */}
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
                color: "#FFFFFF",
                flexShrink: 0,
                transition: "opacity 0.2s",
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
              <SendHorizonal size={20} color="#FFFFFF" strokeWidth={2.5} />
            </button>
          ) : (
            <button
              ref={audioBtnRef}
              className="icon-btn mic-icon-btn"
              disabled={!selectedContact || isRecording}
              onClick={() => {
                if (!isRecording) {
                  onStartAudioRecording();
                }
              }}
              title="Click to record audio"
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#0A1F34",
                border: "none",
                cursor:
                  selectedContact && !isRecording ? "pointer" : "not-allowed",
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

      {/* Emoji Picker - Keep below input */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="emoji-picker-container">
          <emoji-picker className="emoji-picker-element"></emoji-picker>
        </div>
      )}
    </div>
  );
}
