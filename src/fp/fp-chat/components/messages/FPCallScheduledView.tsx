import React from "react";
import { Calendar, X } from "lucide-react";
import type { Message } from "../../../common/types/chat";

interface FPCallScheduledViewProps {
  msg: Message;
}

export default function FPCallScheduledView({
  msg,
}: FPCallScheduledViewProps): React.JSX.Element {
  const isCancelled = msg.messageType === "scheduled_call_canceled";

  // Extract time from system payload or try to parse from content
  let scheduledTime: number | undefined;
  let scheduledDate: Date | null = null;

  if (msg.system?.payload) {
    const payload = msg.system.payload as {
      time?: number | string;
      scheduledDate?: string;
    };

    if (payload.time !== undefined) {
      scheduledTime =
        typeof payload.time === "number"
          ? payload.time
          : typeof payload.time === "string"
          ? parseInt(payload.time, 10)
          : undefined;
    } else if (payload.scheduledDate) {
      scheduledDate = new Date(payload.scheduledDate);
    }
  }

  // If we have time but not date, convert it
  if (scheduledTime && !scheduledDate) {
    scheduledDate = new Date(scheduledTime * 1000); // Convert seconds to milliseconds
  }

  // Try to parse from content if payload doesn't have it
  if (!scheduledDate && typeof msg.content === "string") {
    try {
      const contentObj = JSON.parse(msg.content) as {
        time?: number | string;
        type?: string;
      };
      if (contentObj.time !== undefined) {
        const time =
          typeof contentObj.time === "number"
            ? contentObj.time
            : parseInt(String(contentObj.time), 10);
        scheduledDate = new Date(time * 1000);
      }
    } catch {
      // Content is not JSON, ignore
    }
  }

  // Format the date for display
  const formatDate = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    // Check if it's today
    if (messageDate.getTime() === today.getTime()) {
      return `Today at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    // Check if it's tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (messageDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    // Check if it's this week (within 7 days)
    const daysDiff = Math.floor(
      (messageDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysDiff > 0 && daysDiff <= 7) {
      return `${date.toLocaleDateString([], {
        weekday: "long",
      })} at ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    // Otherwise, show full date and time
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const titleText = isCancelled ? "Scheduled call cancelled" : "Call scheduled";

  const dateTimeText = scheduledDate ? formatDate(scheduledDate) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "8px 12px",
        background: isCancelled ? "#fef2f2" : "#eff6ff",
        borderRadius: "8px",
        border: `1px solid ${isCancelled ? "#fecaca" : "#bfdbfe"}`,
        width: "fit-content",
        maxWidth: "100%",
      }}
    >
      {/* First row: Icon and "Call scheduled" text */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {isCancelled ? (
          <X
            size={16}
            style={{
              color: "#dc2626",
              flexShrink: 0,
            }}
          />
        ) : (
          <Calendar
            size={16}
            style={{
              color: "#000000",
              flexShrink: 0,
            }}
          />
        )}
        <span
          style={{
            fontSize: "13px",
            color: isCancelled ? "#991b1b" : "#000000",
            fontWeight: 500,
          }}
        >
          {titleText}
        </span>
      </div>

      {/* Second row: Date and time */}
      {dateTimeText && (
        <div
          style={{
            fontSize: "12px",
            color: isCancelled ? "#991b1b" : "#000000",
            marginLeft: "24px", // Align with text after icon
            opacity: 0.8,
          }}
        >
          {dateTimeText}
        </div>
      )}
    </div>
  );
}
