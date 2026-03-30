import React from "react";

interface FPImageMessageViewProps {
  imageUrl: string;
  fileName?: string;
  openImageViewer: (url: string, alt?: string) => void;
}

export default function FPImageMessageView({
  imageUrl,
  fileName,
  openImageViewer,
}: FPImageMessageViewProps): React.JSX.Element {
  const [imageError, setImageError] = React.useState(false);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const isTouchDeviceRef = React.useRef(false);

  const handleImageClick = React.useCallback(() => {
    if (imageUrl) {
      openImageViewer(imageUrl, fileName);
    }
  }, [imageUrl, fileName, openImageViewer]);

  // Threshold for determining if it's a tap vs scroll (in pixels)
  const TAP_THRESHOLD = 10;

  return (
    <div
      style={{
        maxWidth: "100%",
        maxHeight: "300px",
        borderRadius: "0.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f3f4f6",
        minHeight: "150px",
        position: "relative",
        cursor: "zoom-in",
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Only handle click on non-touch devices (desktop)
        if (!isTouchDeviceRef.current) {
          handleImageClick();
        }
        // Reset touch device flag after click
        isTouchDeviceRef.current = false;
      }}
      onTouchStart={(e) => {
        isTouchDeviceRef.current = true;
        // Record the starting position
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        
        // Check if touch moved significantly (scrolling) or stayed in place (tap)
        if (touchStartRef.current && e.changedTouches[0]) {
          const touch = e.changedTouches[0];
          const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
          const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
          
          // Only open if it was a tap (minimal movement)
          if (deltaX < TAP_THRESHOLD && deltaY < TAP_THRESHOLD) {
            e.preventDefault();
            handleImageClick();
          }
        }
        
        touchStartRef.current = null;
      }}
    >
      {!imageError ? (
        <img
          src={imageUrl}
          alt={fileName || "Image"}
          className="message-image"
          style={{
            maxWidth: "100%",
            maxHeight: "300px",
            borderRadius: "0.5rem",
            display: "block",
            pointerEvents: "none",
            userSelect: "none",
          }}
          onError={() => {
            setImageError(true);
          }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ marginBottom: "0.5rem" }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>
            Image not available
          </span>
        </div>
      )}
    </div>
  );
}
