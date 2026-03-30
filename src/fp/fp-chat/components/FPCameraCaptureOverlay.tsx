import { RefObject } from "react";
import React from "react";
import { RefreshCw } from "lucide-react";

interface FPCameraCaptureOverlayProps {
  showCameraCapture: boolean;
  videoRef: RefObject<HTMLVideoElement>;
  onClose: () => void;
  onCapture: () => void;
  onFlipCamera?: () => void;
  hasMultipleCameras?: boolean;
}

export default function FPCameraCaptureOverlay({
  showCameraCapture,
  videoRef,
  onClose,
  onCapture,
  onFlipCamera,
  hasMultipleCameras = false,
}: FPCameraCaptureOverlayProps): React.JSX.Element | null {
  if (!showCameraCapture) return null;

  return (
    <div
      className="camera-overlay"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 150,
      }}
    >
      <div
        style={{
          background: "#111827",
          borderRadius: 12,
          padding: 12,
          width: "min(90vw, 640px)",
          position: "relative",
        }}
      >
        {/* Video container with flip button */}
        <div style={{ position: "relative" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          style={{ width: "100%", borderRadius: 8, background: "black" }}
        />
          {/* Flip Camera Button - only shown when multiple cameras available */}
          {hasMultipleCameras && onFlipCamera && (
            <button
              onClick={onFlipCamera}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                width: 44,
                height: 44,
                borderRadius: "50%",
                border: "none",
                background: "rgba(0, 0, 0, 0.5)",
                color: "white",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backdropFilter: "blur(4px)",
                transition: "background 0.2s",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.7)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.5)";
              }}
              title="Flip Camera"
            >
              <RefreshCw size={22} />
            </button>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 8,
            gap: 8,
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "#6b7280",
              color: "white",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onCapture}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 8,
              border: "none",
              background: "#10b981",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
