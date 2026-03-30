import type { Message } from "../../../common/types/chat";
import React from "react";
import { validateImageUrl } from "../../utils/imageValidator";

interface FPCoachAssignedViewProps {
  msg: Message;
}

export default function FPCoachAssignedView({
  msg,
}: FPCoachAssignedViewProps): React.JSX.Element {
  // Extract all fields from payload
  const payload = msg.system?.payload;
  const iconsDetails = payload?.icons_details as
    | { left_icon?: string; right_icon?: string }
    | undefined;

  // Get title from payload - prefer payload.title, then system.name, then fallback
  const title = payload?.title || msg.system?.name || "New coach assigned";

  // Extract redirection_details
  const redirectionDetails = payload?.redirection_details as
    | Array<{
        cta_details?: {
          text?: string;
          text_color?: string;
          bg_color?: string;
        };
        redirect_url?: string;
        action_id?: string;
      }>
    | undefined;

  // Get first redirect detail if available
  const firstDetail = redirectionDetails?.[0];
  const redirectUrl = firstDetail?.redirect_url;
  const actionId = firstDetail?.action_id;

  const handleClick = (): void => {
    // Log action_id for callback/tracking purposes
    if (actionId) {
    }

    if (redirectUrl) {
      if (
        redirectUrl.startsWith("http://") ||
        redirectUrl.startsWith("https://")
      ) {
        window.open(redirectUrl, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = redirectUrl;
      }
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        position: "relative",
        margin: "0.5rem 0",
      }}
    >
      {/* Left line */}
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "#E5E7EB",
        }}
      />
      {/* Notification bubble */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          margin: "0 12px",
          background: "white",
          color: "#0A1F34",
          borderRadius: "20px",
          padding: "8px 16px",
          width: "fit-content",
          border: "1px solid #E7E9EB",
          boxShadow: "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
          position: "relative",
          zIndex: 1,
          cursor: redirectUrl ? "pointer" : "default",
        }}
        onClick={redirectUrl ? handleClick : undefined}
      >
        {/* Left Icon - Default to UserCheck for coach assigned messages */}
        <img
          src={validateImageUrl(iconsDetails?.left_icon, "icon", "UserCheck")}
          alt="Left icon"
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontWeight: 600,
            fontSize: "14px",
            lineHeight: "1.2em",
            color: "#0A1F34",
          }}
        >
          {title}
        </span>
        {/* Right Icon - Default to UserCheck for coach assigned messages */}
        {iconsDetails?.right_icon && (
          <img
            src={validateImageUrl(iconsDetails.right_icon, "icon", "UserCheck")}
            alt="Right icon"
            style={{
              width: "16px",
              height: "16px",
              flexShrink: 0,
            }}
          />
        )}
      </div>
      {/* Right line */}
      <div
        style={{
          flex: 1,
          height: "1px",
          background: "#E5E7EB",
        }}
      />
    </div>
  );
}
