import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { initializeHlsPlayer, cleanupHlsPlayer } from "../utils/hlsPlayer";
import Hls from "hls.js";

interface FPAudioPlayerProps {
  audioUrl: string | null | undefined;
  onClose: () => void;
}

export default function FPAudioPlayer({
  audioUrl,
  onClose,
}: FPAudioPlayerProps): React.JSX.Element | null {
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    const audioElement = audioRef.current;
    setIsLoading(true);
    setError(null);

    // Initialize HLS player if URL is HLS stream
    if (audioUrl.includes(".m3u8")) {
      const hls = initializeHlsPlayer(audioElement, audioUrl);
      hlsRef.current = hls;
    } else {
      // For regular audio files, set src directly
      audioElement.src = audioUrl;
    }

    // Handle audio events
    const handleLoadedData = (): void => {
      setIsLoading(false);
    };

    const handleError = (): void => {
      setIsLoading(false);
      setError("Failed to load audio. Please try again later.");
    };

    const handleCanPlay = (): void => {
      setIsLoading(false);
    };

    audioElement.addEventListener("loadeddata", handleLoadedData);
    audioElement.addEventListener("error", handleError);
    audioElement.addEventListener("canplay", handleCanPlay);

    // Cleanup function
    return () => {
      audioElement.removeEventListener("loadeddata", handleLoadedData);
      audioElement.removeEventListener("error", handleError);
      audioElement.removeEventListener("canplay", handleCanPlay);
      cleanupHlsPlayer(hlsRef.current);
    };
  }, [audioUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHlsPlayer(hlsRef.current);
    };
  }, []);

  if (!audioUrl) return null;

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
          width: "90vw",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "default",
          padding: "40px",
          background: "#000",
          borderRadius: "12px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        {/* Close button */}
        <div
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
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
          <X size={20} color="#ffffff" strokeWidth={2.5} />
        </div>

        {/* Audio container */}
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "20px",
          }}
        >
          {/* Title */}
          <h3
            style={{
              color: "#ffffff",
              fontSize: "18px",
              fontWeight: 600,
              margin: 0,
            }}
          >
            Voice Recording
          </h3>

          {/* Loading indicator */}
          {isLoading && (
            <div
              style={{
                color: "#fff",
                fontSize: "16px",
              }}
            >
              Loading audio...
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              style={{
                color: "#ef4444",
                fontSize: "16px",
                padding: "20px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          {/* Audio element */}
          {!error && (
            <audio
              ref={audioRef}
              controls
              style={{
                width: "100%",
                maxWidth: "500px",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
