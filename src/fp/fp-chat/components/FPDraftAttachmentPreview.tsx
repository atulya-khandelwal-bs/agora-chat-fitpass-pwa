import React, { RefObject } from "react";
import type { DraftAttachment } from "../../common/types/chat";

interface FPDraftAttachmentPreviewProps {
  draftAttachment: DraftAttachment | null;
  onRemove: () => void;
  onImageClick: (url: string, alt?: string) => void;
  formatDuration: (seconds: number) => string;
  currentlyPlayingAudioRef: RefObject<HTMLAudioElement | null>;
}

export default function FPDraftAttachmentPreview({
  draftAttachment,
  onRemove,
  onImageClick,
  formatDuration,
  currentlyPlayingAudioRef,
}: FPDraftAttachmentPreviewProps): React.JSX.Element | null {
  // Format file size helper
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    const kb = bytes / 1024;
    if (kb >= 1024) {
      return `${(kb / 1024).toFixed(1)} MB`;
    }
    return `${Math.round(kb)} KB`;
  };

  if (!draftAttachment) return null;

  return (
    <div
      className="attachment-preview"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        marginBottom: 8,
        background: "#f3f4f6",
        borderRadius: 12,
        boxShadow: "inset 0 0 0 1px #e5e7eb",
      }}
    >
      {draftAttachment.type === "image" ? (
        <img
          src={draftAttachment.url}
          alt={draftAttachment.fileName}
          onClick={() =>
            onImageClick(draftAttachment.url, draftAttachment.fileName)
          }
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 8,
            cursor: "zoom-in",
            pointerEvents: "auto",
            userSelect: "none",
          }}
        />
      ) : draftAttachment.type === "audio" ? (
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"
              fill="currentColor"
            />
            <path
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
              fill="currentColor"
            />
          </svg>
        </div>
      ) : (
        <div
          aria-hidden
          style={{
            width: 48,
            height: 48,
            borderRadius: 8,
            background: "#fee2e2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#b91c1c",
            fontWeight: 700,
            fontSize: 12,
          }}
        >
          {draftAttachment.mimeType && draftAttachment.mimeType.includes("pdf")
            ? "PDF"
            : "FILE"}
        </div>
      )}
      <div style={{ minWidth: 0, flex: 1 }}>
        {draftAttachment.type === "audio" ? (
          <>
            <div
              style={{
                fontWeight: 600,
                color: "#0f172a",
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              Audio
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              <audio
                controls
                src={draftAttachment.url}
                style={{
                  height: 32,
                  minWidth: 200,
                  maxWidth: "100%",
                }}
                onPlay={(e) => {
                  // Pause other audio if playing
                  if (
                    currentlyPlayingAudioRef?.current &&
                    currentlyPlayingAudioRef.current !== e.target
                  ) {
                    currentlyPlayingAudioRef.current.pause();
                  }
                  if (currentlyPlayingAudioRef) {
                    currentlyPlayingAudioRef.current =
                      e.target as HTMLAudioElement;
                  }
                }}
                onEnded={(e) => {
                  if (currentlyPlayingAudioRef?.current === e.target) {
                    currentlyPlayingAudioRef.current = null;
                  }
                }}
                onPause={(e) => {
                  if (currentlyPlayingAudioRef?.current === e.target) {
                    currentlyPlayingAudioRef.current = null;
                  }
                }}
              />
              <div
                style={{
                  fontSize: 12,
                  color: "#6b7280",
                  whiteSpace: "nowrap",
                }}
              >
                {draftAttachment.duration != null
                  ? formatDuration(draftAttachment.duration)
                  : "Recording"}
                {draftAttachment.size != null
                  ? ` • ${formatFileSize(draftAttachment.size)}`
                  : ""}
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              style={{
                fontWeight: 600,
                color: "#0f172a",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {draftAttachment.fileName}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              {(draftAttachment.mimeType || "").toUpperCase()}
              {draftAttachment.size != null
                ? ` • ${formatFileSize(draftAttachment.size)}`
                : ""}
            </div>
          </>
        )}
      </div>
      <button
        onClick={onRemove}
        title="Remove"
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          background: "#e5e7eb",
          color: "#374151",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
