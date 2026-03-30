import React from "react";
import { ChevronRight } from "lucide-react";
import type { Message } from "../../common/types/chat";

interface FPScheduledCallBannerProps {
  scheduledCall: Message;
  scheduledCallFromApi?: {
    call_date_time: number;
    call_type?: "video" | "audio";
  } | null;
  onClick?: () => void;
}

export default function FPScheduledCallBanner({
  scheduledCall,
  scheduledCallFromApi,
  onClick,
}: FPScheduledCallBannerProps): React.JSX.Element | null {
  // Extract scheduled time
  let scheduledTime: number | undefined;
  let scheduledDate: Date | null = null;

  // Debug logging

  if (scheduledCall.system?.payload) {
    const payload = scheduledCall.system.payload as {
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
    scheduledDate = new Date(scheduledTime * 1000);
  }

  // Try to parse from content if payload doesn't have it
  if (!scheduledDate && typeof scheduledCall.content === "string") {
    try {
      const contentObj = JSON.parse(scheduledCall.content) as {
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
    } catch (e) {
      // Content is not JSON, ignore
    }
  }

  // Format the date and time for display
  const formatDateTime = (date: Date): string => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const messageDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

    // Check if it's today
    if (messageDate.getTime() === today.getTime()) {
      return `Today, ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    // Check if it's tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (messageDate.getTime() === tomorrow.getTime()) {
      return `Tomorrow, ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })}`;
    }

    // Otherwise, show date and time
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
    return `${date.getDate()} ${
      monthNames[date.getMonth()]
    }, ${date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })}`;
  };

  // Don't render if we don't have a valid date
  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return null;
  }

  const dateTimeText = formatDateTime(scheduledDate);

  // Check if we're within 5 minutes of the scheduled time
  const isWithinFiveMinutes = (): boolean => {
    if (!scheduledCallFromApi?.call_date_time) {
      // Fallback to scheduledCall time if scheduledCallFromApi is not available
      if (!scheduledTime) {
        return false;
      }
      const scheduledDateFromTime = new Date(scheduledTime * 1000);
      const now = new Date();
      const timeDiff = scheduledDateFromTime.getTime() - now.getTime();
      const fiveMinutesInMs = 5 * 60 * 1000;
      return timeDiff > 0 && timeDiff <= fiveMinutesInMs;
    }

    const scheduledDateFromApi = new Date(
      scheduledCallFromApi.call_date_time * 1000
    );
    const now = new Date();

    // Can't join if scheduled time is in the past
    if (scheduledDateFromApi <= now) {
      return false;
    }

    // Calculate time difference in milliseconds
    const timeDiff = scheduledDateFromApi.getTime() - now.getTime();
    const fiveMinutesInMs = 5 * 60 * 1000; // 5 minutes in milliseconds

    // Can join only if within 5 minutes
    return timeDiff <= fiveMinutesInMs;
  };

  const canJoinCall = isWithinFiveMinutes();
  // Only allow onClick if within 5 minutes
  const handleClick = canJoinCall ? onClick : undefined;

  return (
    <div
      onClick={handleClick}
      className="scheduled-call-banner"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "0.75rem 1rem",
        backgroundColor: "#F3FAF3",
        cursor: handleClick ? "pointer" : "default",
        transition: "opacity 0.2s",
        width: "100%",
        boxSizing: "border-box",
        border: "1px solid #E7E9EB",
        height: "50px",
        top: "56px"
      }}
      onMouseEnter={(e) => {
        if (handleClick) {
          e.currentTarget.style.opacity = "0.9";
        }
      }}
      onMouseLeave={(e) => {
        if (handleClick) {
          e.currentTarget.style.opacity = "1";
        }
      }}
    >
      {/* Phone Icon */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="20" height="20" rx="10" fill="#109310" />
        <g clip-path="url(#clip0_1_198)">
          <path
            d="M11.7058 10.8128C11.7577 10.7783 11.8174 10.7572 11.8796 10.7515C11.9417 10.7459 12.0042 10.7558 12.0616 10.7805L14.2722 11.7709C14.3467 11.8028 14.4089 11.8579 14.4494 11.928C14.49 11.9982 14.5067 12.0795 14.4972 12.16C14.4244 12.7042 14.1564 13.2035 13.743 13.565C13.3296 13.9264 12.7991 14.1254 12.25 14.125C10.5592 14.125 8.93774 13.4533 7.7422 12.2578C6.54665 11.0623 5.875 9.44075 5.875 7.75C5.87458 7.20091 6.0736 6.67035 6.43505 6.257C6.79649 5.84365 7.29576 5.57564 7.84 5.50281C7.92045 5.49325 8.00184 5.51001 8.07197 5.55057C8.14211 5.59113 8.19722 5.65331 8.22906 5.72781L9.21953 7.94031C9.24387 7.99714 9.25378 8.0591 9.24838 8.12068C9.24298 8.18226 9.22244 8.24155 9.18859 8.29328L8.18688 9.48437C8.15134 9.53799 8.13033 9.59991 8.12589 9.66408C8.12146 9.72825 8.13375 9.79247 8.16156 9.85047C8.54922 10.6441 9.36953 11.4545 10.1655 11.8384C10.2238 11.8661 10.2883 11.8781 10.3527 11.8733C10.417 11.8684 10.479 11.8469 10.5325 11.8108L11.7058 10.8128Z"
            fill="white"
          />
        </g>
        <defs>
          <clipPath id="clip0_1_198">
            <rect
              width="12"
              height="12"
              fill="white"
              transform="translate(4 4)"
            />
          </clipPath>
        </defs>
      </svg>

      {/* Text */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 600,
            color: "#109310",
          }}
        >
          Call scheduled
        </span>
        <span
          style={{
            fontSize: "14px",
            color: "#0A1F34",
            opacity: 0.9,
            fontWeight: 600,
          }}
        >
          {dateTimeText}
        </span>
      </div>

      {/* Arrow Icon - Only show if within 5 minutes */}
      {canJoinCall && handleClick && <ChevronRight size={12} color="#FFFFFF" />}
    </div>
  );
}
