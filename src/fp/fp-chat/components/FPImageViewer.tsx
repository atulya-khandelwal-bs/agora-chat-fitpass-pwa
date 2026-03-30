
import React from "react";

interface FPImageViewerProps {
  imageUrl: string | null | undefined;
  imageAlt?: string;
  onClose: () => void;
}

export default function FPImageViewer({
  imageUrl,
  imageAlt,
  onClose,
}: FPImageViewerProps): React.JSX.Element | null {
  if (!imageUrl) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        cursor: "zoom-out",
      }}
    >
      <img
        src={imageUrl}
        alt={imageAlt || "Image"}
        onClick={onClose}
        style={{
          maxWidth: "95vw",
          maxHeight: "95vh",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          cursor: "zoom-out",
        }}
      />
    </div>
  );
}
