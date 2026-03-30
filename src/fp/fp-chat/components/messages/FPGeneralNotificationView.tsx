import React from "react";
import { formatTextWithTags } from "../../utils/textFormatter";

interface FPGeneralNotificationViewProps {
  title?: string;
  description?: string;
  redirection_details?: Array<{
    cta_details?: {
      text?: string;
      text_color?: string;
      bg_color?: string;
    };
    redirect_url?: string;
    action_id?: string;
  }>;
}

export default function FPGeneralNotificationView({
  title,
  description,
  redirection_details,
}: FPGeneralNotificationViewProps): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
        width: "100%",
      }}
    >
      {/* Title */}
      {title && (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            lineHeight: "1.4em",
            color: "#374151",
            marginBottom: description ? "8px" : "0",
            textAlign: "left",
          }}
        >
          {formatTextWithTags(title)}
        </div>
      )}

      {/* Description */}
      {description && (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 400,
            lineHeight: "1.4em",
            color: "#374151",
            marginBottom:
              redirection_details && redirection_details.length > 0
                ? "12px"
                : "0",
            textAlign: "left",
          }}
        >
          {formatTextWithTags(description)}
        </div>
      )}

      {/* Action Buttons */}
      {redirection_details && redirection_details.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginTop: "12px",
            overflowX: "auto",
            overflowY: "hidden",
            scrollbarWidth: "none",
            justifyContent: "flex-start",
            minWidth: 0,
            WebkitOverflowScrolling: "touch",
          }}
        >
          {redirection_details.map((detail, index) => {
            // Button text: use text if available and not empty, otherwise use text_color as fallback
            const buttonText =
              detail.cta_details?.text && detail.cta_details.text.trim() !== ""
                ? detail.cta_details.text
                : detail.cta_details?.text_color || `Button ${index + 1}`;

            // Background color: use bg_color from cta_details with fallback
            const bgColor = detail.cta_details?.bg_color || "#109310";

            // Text color logic:
            // - If text exists and is not empty: text_color is the actual text color
            // - If text doesn't exist or is empty: text_color is the button label, so determine text color based on background
            let textColor = "#FFFFFF"; // Default

            if (
              detail.cta_details?.text &&
              detail.cta_details.text.trim() !== ""
            ) {
              // text exists and is not empty, so text_color is the actual text color
              textColor = detail.cta_details.text_color || "#FFFFFF";
            } else {
              // text doesn't exist or is empty, text_color is the button label
              // Determine text color based on background brightness
              const isLightBackground =
                !bgColor ||
                bgColor === "" ||
                bgColor === "#FFFFFF" ||
                bgColor === "#FFF" ||
                bgColor.toLowerCase() === "white";
              textColor = isLightBackground ? "#000000" : "#FFFFFF";
            }

            // Calculate hover color (darker shade of bg_color)
            const getHoverColor = (color: string): string => {
              if (
                !color ||
                color === "" ||
                color === "#FFFFFF" ||
                color === "#FFF" ||
                color.toLowerCase() === "white"
              ) {
                return "#e5e7eb"; // Light gray hover for white/empty buttons
              }
              // Convert hex to RGB and darken by 10%
              try {
                const hex = color.replace("#", "");
                if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
                  const r = parseInt(hex.substring(0, 2), 16);
                  const g = parseInt(hex.substring(2, 4), 16);
                  const b = parseInt(hex.substring(4, 6), 16);
                  const darken = (val: number) =>
                    Math.max(0, Math.floor(val * 0.9));
                  return `rgb(${darken(r)}, ${darken(g)}, ${darken(b)})`;
                }
              } catch {
                // If parsing fails, return default
              }
              return "#0d7a0d"; // Default hover color
            };

            const hoverColor = getHoverColor(bgColor);

            return (
              <button
                key={index}
                onClick={() => {
                  // Log action_id for callback/tracking purposes
                  if (detail.action_id) {
                  }
                  // Handle button click - navigate to redirect_url
                  if (detail.redirect_url) {
                    // Check if it's a full URL or a route
                    if (
                      detail.redirect_url.startsWith("http://") ||
                      detail.redirect_url.startsWith("https://")
                    ) {
                      window.open(
                        detail.redirect_url,
                        "_blank",
                        "noopener,noreferrer"
                      );
                    } else {
                      // Handle internal route navigation
                      // You can add router navigation here if using React Router
                      // For now, we'll treat it as a URL
                      window.location.href = detail.redirect_url;
                    }
                  }
                }}
                style={{
                  width: "129px",
                  minWidth: "129px",
                  flexShrink: 0,
                  height: "36px",
                  padding: "0 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: bgColor,
                  color: textColor,
                  border: "none",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = hoverColor;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = bgColor;
                }}
              >
                {buttonText}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
