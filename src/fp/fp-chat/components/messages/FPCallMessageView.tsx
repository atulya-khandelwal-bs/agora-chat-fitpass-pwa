import React from "react";
import { Video, Phone } from "lucide-react";
import { validateImageUrl } from "../../utils/imageValidator";

interface FPCallMessageViewProps {
  callType: "video_call" | "voice_call";
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
  onPlayVideo?: (
    videoUrl: string,
    callType?: "video_call" | "voice_call"
  ) => void;
}

export default function FPCallMessageView({
  callType,
  title,
  description,
  icons_details,
  call_details,
  onPlayVideo,
}: FPCallMessageViewProps): React.JSX.Element {
  const isVideoCall = callType === "video_call";
  const displayTitle = title || (isVideoCall ? "Video call" : "Voice call");
  const displayDescription = description || "";

  const videoUrl = call_details?.call_url;

  const handlePlayVideo = (e: React.MouseEvent): void => {
    e.stopPropagation(); // Prevent triggering the parent onClick
    if (videoUrl && onPlayVideo) {
      onPlayVideo(videoUrl, callType);
    }
  };

  return (
    <div
      onClick={videoUrl && onPlayVideo ? handlePlayVideo : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        height: "54px",
        padding: "10px",
        width: "100%",
        borderRadius: "8px",
        background: "#e5e7eb",
        cursor: videoUrl && onPlayVideo ? "pointer" : "default",
        transition: "background 0.2s",
      }}
      onMouseEnter={(e) => {
        if (videoUrl && onPlayVideo) {
          e.currentTarget.style.background = "#e5e7eb";
        }
      }}
      onMouseLeave={(e) => {
        if (videoUrl && onPlayVideo) {
          e.currentTarget.style.background = "#f3f4f6";
        }
      }}
    >
      {/* Icon with circular background */}
      <div
        style={{
          width: "25px",
          height: "25px",
          borderRadius: "50%",
          background: "#109310",
          color: "#FFFFFF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icons_details?.left_icon ? (
          <img
            src={validateImageUrl(icons_details.left_icon, "icon")}
            alt="Call icon"
            style={{
              width: "20px",
              height: "20px",
            }}
          />
        ) : (
          <div>
            {isVideoCall ? (
              <Video
                size={12}
                style={{
                  color: "",
                }}
              />
            ) : (
              <Phone
                size={12}
                style={{
                  color: "",
                }}
              />
            )}
          </div>
        )}
      </div>

      {/* Title and Duration */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          flex: 1,
        }}
      >
        <span
          style={{
            fontWeight: 600,
            color: "#111827",
            fontSize: "14px",
            textAlign: "left",
          }}
        >
          {displayTitle}
        </span>
        {displayDescription && (
          <span
            style={{
              fontSize: "12px",
              color: "#6b7280",
              textAlign: "left",
            }}
          >
            {displayDescription}
          </span>
        )}
      </div>
    </div>
  );
}
