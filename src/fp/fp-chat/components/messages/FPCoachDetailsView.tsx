import type { Message } from "../../../common/types/chat";
import React from "react";
import { validateImageUrl } from "../../utils/imageValidator";

interface FPCoachDetailsViewProps {
  msg: Message;
}

export default function FPCoachDetailsView({
  msg,
}: FPCoachDetailsViewProps): React.JSX.Element {
  // Extract all fields from payload
  const payload = msg.system?.payload;
  const iconsDetails = payload?.icons_details as
    | { left_icon?: string; right_icon?: string }
    | undefined;

  // Get title from payload (required field) - used for notification bubble
  const title = payload?.title || msg.system?.name || "User";

  // Get description from payload (required field) - used for coach card subtitle
  const description =
    payload?.description || msg.system?.title || "Nutritionist";

  // Get name for coach card - prefer payload title, then system name
  const coachName = payload?.title || msg.system?.name || title;

  // Get profile photo - prefer system.profilePhoto, then icons_details.left_icon
  const profilePhoto = msg.system?.profilePhoto || iconsDetails?.left_icon;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        margin: "0.75rem 0",
        width: "100%",
      }}
    >
      {/* Coach card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          background: "white",
          borderRadius: "12px",
          padding: "12px",
          border: "1px solid #E7E9EB",
          boxShadow: "0px 1px 2px 0px rgba(35, 37, 52, 0.06)",
          cursor: "pointer",
          width: "100%",
        }}
        onClick={() => {
          // Handle card click - use redirection_details if available
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

          const firstDetail = redirectionDetails?.[0];
          const redirectUrl = firstDetail?.redirect_url;
          const actionId = firstDetail?.action_id;

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
          } else {
          }
        }}
      >
        {/* Profile photo */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
            background: "#F3F4F6",
            border: "1px solid #E7E9EB",
          }}
        >
          {profilePhoto ? (
            <img
              src={validateImageUrl(profilePhoto, "avatar")}
              alt={coachName || "Coach"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  parent.style.display = "flex";
                  parent.style.alignItems = "center";
                  parent.style.justifyContent = "center";
                  parent.style.color = "#9CA3AF";
                  parent.style.fontSize = "20px";
                  parent.textContent = (coachName || "N")[0].toUpperCase();
                }
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9CA3AF",
                fontSize: "20px",
                fontWeight: 600,
              }}
            >
              {(coachName || "N")[0].toUpperCase()}
            </div>
          )}
        </div>

        {/* Name and title */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "13px",
                lineHeight: "1.2em",
                color: "#0A1F34",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {coachName}
            </span>
            {/* Verified badge - Default to SealCheck for coach details */}
            <img
              src={validateImageUrl(
                iconsDetails?.right_icon,
                "icon",
                "SealCheck"
              )}
              alt="Verified"
              style={{
                width: "16px",
                height: "16px",
                flexShrink: 0,
              }}
            />
          </div>
          <span
            style={{
              fontSize: "12px",
              lineHeight: "1.2em",
              color: "#6C7985",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
            }}
          >
            {description}
          </span>
        </div>

        {/* Right arrow icon */}
        <div
          style={{
            width: "20px",
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            color: "#6C7985",
          }}
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7.5 5L12.5 10L7.5 15"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
