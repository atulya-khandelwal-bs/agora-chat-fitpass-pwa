import { RefObject, useEffect, useRef, useState } from "react";
import FPMessageBubble from "./FPMessageBubble";
import FPSystemMessage from "./FPSystemMessage";
import type { Message } from "../../common/types/chat";
import React from "react";

interface FPChatTabProps {
  groupId: string;
  currentConversationMessages: Message[];
  formatDateLabel: (date: Date) => string;
  formatCurrency: (amount: number) => string;
  openImageViewer: (url: string, alt?: string) => void;
  currentlyPlayingAudioRef: RefObject<HTMLAudioElement | null>;
  onPlayVideo?: (
    videoUrl: string,
    callType?: "video_call" | "voice_call"
  ) => void;
  /** When true, matches visible `FPScheduledCallBanner` — extra top spacing for messages + date tag */
  hasScheduledCallBanner?: boolean;
}

export default function FPChatTab({
  groupId,
  currentConversationMessages,
  formatDateLabel,
  formatCurrency,
  openImageViewer,
  currentlyPlayingAudioRef,
  onPlayVideo,
  hasScheduledCallBanner = false,
}: FPChatTabProps): React.JSX.Element {
  const [visibleDate, setVisibleDate] = useState<string | null>(null);
  const [showTag, setShowTag] = useState<boolean>(false);
  const dateSeparatorRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const chatAreaRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (dateSeparatorRefs.current.size === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the date separator that's closest to the top of the viewport
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);

        if (visibleEntries.length === 0) {
          // If no separators are visible, find the one that's just above the viewport
          const allEntries = entries
            .filter(
              (entry) => entry.boundingClientRect.top < window.innerHeight
            )
            .sort(
              (a, b) => b.boundingClientRect.top - a.boundingClientRect.top
            );

          if (allEntries.length > 0) {
            const topEntry = allEntries[0];
            const dateKey = topEntry.target.getAttribute("data-date-key");
            if (dateKey) {
              setVisibleDate(dateKey);
            }
            return;
          }
        }

        // Sort visible entries by their position (top to bottom)
        const sortedEntries = visibleEntries.sort((a, b) => {
          const aTop = a.boundingClientRect.top;
          const bTop = b.boundingClientRect.top;
          return aTop - bTop;
        });

        if (sortedEntries.length > 0) {
          const topEntry = sortedEntries[0];
          const dateKey = topEntry.target.getAttribute("data-date-key");
          if (dateKey) {
            setVisibleDate(dateKey);
          }
        }
      },
      {
        root: null, // Use viewport
        rootMargin: "-100px 0px 0px 0px", // Offset from top
        threshold: [0, 0.1, 0.5, 1],
      }
    );

    // Observe all date separators
    dateSeparatorRefs.current.forEach((element) => {
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [currentConversationMessages]);

  // Handle scroll and touch events to show tag and reset hide timeout
  useEffect(() => {
    // Find the chat area element (scrollable container)
    const chatArea = containerRef.current?.closest(
      ".chat-area"
    ) as HTMLElement | null;
    chatAreaRef.current = chatArea;

    if (!chatArea) return;

    const handleActivity = (): void => {
      if (visibleDate) {
        setShowTag(true);

        // Clear existing timeout
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }

        // Set new timeout to hide after 3 seconds
        hideTimeoutRef.current = setTimeout(() => {
          setShowTag(false);
        }, 3000);
      }
    };

    const handleScroll = (): void => {
      handleActivity();
    };

    const handleTouchStart = (): void => {
      handleActivity();
    };

    const handleTouchMove = (): void => {
      handleActivity();
    };

    chatArea.addEventListener("scroll", handleScroll, { passive: true });
    chatArea.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    chatArea.addEventListener("touchmove", handleTouchMove, { passive: true });
    // Also listen on window for touch events
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    return () => {
      chatArea.removeEventListener("scroll", handleScroll);
      chatArea.removeEventListener("touchstart", handleTouchStart);
      chatArea.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [visibleDate]);

  // Show tag when visibleDate changes
  useEffect(() => {
    if (visibleDate) {
      setShowTag(true);

      // Clear existing timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      // Set timeout to hide after 3 seconds
      hideTimeoutRef.current = setTimeout(() => {
        setShowTag(false);
      }, 3000);
    } else {
      setShowTag(false);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    }

    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [visibleDate]);

  // Get the date label for the visible date
  const getVisibleDateLabel = (): string | null => {
    if (!visibleDate) return null;

    // Find the message with this date key
    for (const msg of currentConversationMessages) {
      const createdAt = msg.createdAt ? new Date(msg.createdAt) : new Date();
      const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
      if (dayKey === visibleDate) {
        return formatDateLabel(createdAt);
      }
    }
    return null;
  };

  const visibleDateLabel = getVisibleDateLabel();

  return (
    <div
      className={`messages-container${hasScheduledCallBanner ? " messages-container--with-scheduled-banner" : ""}`}
      ref={containerRef}
    >
      {/* Floating Date Tag */}
      {visibleDateLabel && (
        <div
          className="floating-date-tag"
          style={{
            position: "sticky",
            top: hasScheduledCallBanner ? "6rem" : "3.2rem",
            zIndex: 100,
            display: "flex",
            justifyContent: "center",
            marginBottom: "0.5rem",
            pointerEvents: "none",
            padding: "0 1rem",
            opacity: showTag ? 1 : 0,
            transform: showTag ? "translateY(0)" : "translateY(-20px)",
            transition: "opacity 0.3s ease-out, transform 0.3s ease-out",
          }}
        >
          <div
            style={{
              backgroundColor: "#e5e7eb",
              color: "#000",
              padding: "0.375rem 0.75rem",
              borderRadius: "100px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backdropFilter: "blur(8px)",
            }}
          >
            {visibleDateLabel}
          </div>
        </div>
      )}

      {!groupId || currentConversationMessages.length === 0 ? (
        <div className="empty-chat">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        // Render messages with day separators like WhatsApp
        (() => {
          const items: React.JSX.Element[] = [];
          let lastDayKey: string | null = null;
          /** Last regular chat bubble direction; reset after day separator or system so spacing restarts */
          let lastBubbleIncoming: boolean | null = null;
          /** So the message after a products row gets 12px separation */
          let lastRowWasProducts = false;

          // Find the last non-system message to determine which message should show the SVG
          let lastNonSystemMessageIndex = -1;
          for (let i = currentConversationMessages.length - 1; i >= 0; i--) {
            const msg = currentConversationMessages[i];
            if (!(msg.messageType === "system" && msg.system)) {
              lastNonSystemMessageIndex = i;
              break;
            }
          }

          currentConversationMessages.forEach((msg, index) => {
            const createdAt = msg.createdAt
              ? new Date(msg.createdAt)
              : new Date();
            const dayKey = `${createdAt.getFullYear()}-${createdAt.getMonth()}-${createdAt.getDate()}`;
            if (dayKey !== lastDayKey) {
              lastDayKey = dayKey;
              const separatorRef = (el: HTMLDivElement | null) => {
                if (el) {
                  dateSeparatorRefs.current.set(dayKey, el);
                } else {
                  dateSeparatorRefs.current.delete(dayKey);
                }
              };

              items.push(
                <div
                  key={`day-${dayKey}-${index}`}
                  ref={separatorRef}
                  data-date-key={dayKey}
                  className="day-separator"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    margin: "20px 0",
                    color: "#6b7280",
                    fontSize: "0.75rem",
                  }}
                >
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                  <span>{formatDateLabel(createdAt)}</span>
                  <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
                </div>
              );
              lastBubbleIncoming = null;
              lastRowWasProducts = false;
            }

            if (msg.messageType === "system" && msg.system) {
              items.push(<FPSystemMessage key={msg.id} msg={msg} />);
              lastBubbleIncoming = null;
              lastRowWasProducts = false;
            } else {
              const isLastMessage = index === lastNonSystemMessageIndex;
              const stackMarginTopPx =
                lastBubbleIncoming === null
                  ? 0
                  : lastBubbleIncoming === msg.isIncoming
                    ? 4
                    : 12;
              /* Products: marginTop 12 below prior bubble; marginBottom 12 on wrapper — next row top 0 to avoid doubling */
              const effectiveStackMarginTopPx = lastRowWasProducts
                ? 0
                : lastBubbleIncoming !== null && msg.messageType === "products"
                  ? 12
                  : stackMarginTopPx;
              lastBubbleIncoming = msg.isIncoming;
              lastRowWasProducts = msg.messageType === "products";
              items.push(
                <FPMessageBubble
                  key={msg.id}
                  msg={msg}
                  openImageViewer={openImageViewer}
                  currentlyPlayingAudioRef={currentlyPlayingAudioRef}
                  formatCurrency={formatCurrency}
                  onPlayVideo={onPlayVideo}
                  isLastMessage={isLastMessage}
                  stackMarginTopPx={effectiveStackMarginTopPx}
                  stackMarginBottomPx={
                    msg.messageType === "products" ? 12 : undefined
                  }
                />
              );
            }
          });
          return items;
        })()
      )}
    </div>
  );
}
