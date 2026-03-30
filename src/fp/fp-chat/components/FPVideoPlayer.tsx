import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { initializeHlsPlayer, cleanupHlsPlayer } from "../utils/hlsPlayer";
import Hls from "hls.js";

interface FPVideoPlayerProps {
  videoUrl: string | null | undefined;
  onClose: () => void;
}

export default function FPVideoPlayer({
  videoUrl,
  onClose,
}: FPVideoPlayerProps): React.JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    const videoElement = videoRef.current;
    setIsLoading(true);
    setError(null);

    // Initialize HLS player
    const hls = initializeHlsPlayer(videoElement, videoUrl);
    hlsRef.current = hls;

    // Handle video events
    const handleLoadedData = (): void => {
      setIsLoading(false);
    };

    const handleError = (): void => {
      setIsLoading(false);
      setError("Failed to load video. Please try again later.");
    };

    const handleCanPlay = (): void => {
      setIsLoading(false);
    };

    videoElement.addEventListener("loadeddata", handleLoadedData);
    videoElement.addEventListener("error", handleError);
    videoElement.addEventListener("canplay", handleCanPlay);

    // Cleanup function
    return () => {
      videoElement.removeEventListener("loadeddata", handleLoadedData);
      videoElement.removeEventListener("error", handleError);
      videoElement.removeEventListener("canplay", handleCanPlay);
      cleanupHlsPlayer(hls);
    };
  }, [videoUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHlsPlayer(hlsRef.current);
    };
  }, []);

  if (!videoUrl) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 60,
        cursor: "pointer",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "95vw",
          maxWidth: "1200px",
          maxHeight: "95vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "default",
        }}
      >
        {/* Close button */}
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            top: "-40px",
            right: 0,
            background: "rgba(255,255,255,0.1)",
            border: "none",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#ffffff",
            zIndex: 10,
            transition: "background 0.2s",
          }}
        >
          <X size={20} />
        </div>

        {/* Video container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            paddingBottom: "56.25%", // 16:9 aspect ratio
            background: "#000",
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
          }}
        >
          {/* Loading indicator */}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontSize: "16px",
                }}
              >
                Loading video...
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#000",
                color: "#fff",
                fontSize: "16px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Video element */}
          <video
            ref={videoRef}
            controls
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
            playsInline
          />
        </div>
      </div>
    </div>
  );
}
