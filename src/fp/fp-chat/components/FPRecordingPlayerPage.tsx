import React, { useEffect, useRef, useState } from "react";
import { initializeHlsPlayer, cleanupHlsPlayer } from "../utils/hlsPlayer";
import Hls from "hls.js";

/**
 * Standalone recording player page that can be opened in a new tab
 * Reads URL parameters to get the recording URL and type
 */
export default function FPRecordingPlayerPage(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [callType, setCallType] = useState<"video_call" | "voice_call" | null>(
    null
  );

  useEffect(() => {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const url = urlParams.get("url");
    const type = urlParams.get("type") as "video_call" | "voice_call" | null;

    if (!url) {
      setError("No recording URL provided");
      setIsLoading(false);
      return;
    }

    setRecordingUrl(url);
    setCallType(type || "video_call"); // Default to video_call if not specified
  }, []);

  useEffect(() => {
    if (!recordingUrl) return;

    const isAudio = callType === "voice_call";
    const mediaElement = isAudio
      ? (audioRef.current as HTMLAudioElement | null)
      : (videoRef.current as HTMLVideoElement | null);

    if (!mediaElement) return;

    setIsLoading(true);
    setError(null);

    // Initialize HLS player if URL is HLS stream
    if (recordingUrl.includes(".m3u8")) {
      const hls = initializeHlsPlayer(mediaElement, recordingUrl);
      hlsRef.current = hls;
    } else {
      // For regular video/audio files, set src directly
      mediaElement.src = recordingUrl;
    }

    // Handle media events
    const handleLoadedData = (): void => {
      setIsLoading(false);
    };

    const handleError = (): void => {
      setIsLoading(false);
      setError("Failed to load recording. Please try again later.");
    };

    const handleCanPlay = (): void => {
      setIsLoading(false);
    };

    mediaElement.addEventListener("loadeddata", handleLoadedData);
    mediaElement.addEventListener("error", handleError);
    mediaElement.addEventListener("canplay", handleCanPlay);

    // Cleanup function
    return () => {
      mediaElement.removeEventListener("loadeddata", handleLoadedData);
      mediaElement.removeEventListener("error", handleError);
      mediaElement.removeEventListener("canplay", handleCanPlay);
      cleanupHlsPlayer(hlsRef.current);
    };
  }, [recordingUrl, callType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupHlsPlayer(hlsRef.current);
    };
  }, []);

  if (!recordingUrl) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000",
          color: "#fff",
        }}
      >
        <div>Loading recording player...</div>
      </div>
    );
  }

  const isAudio = callType === "voice_call";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#000",
        flexDirection: "column",
        gap: "20px",
        padding: "20px",
      }}
    >
      {/* Title */}
      <h1
        style={{
          color: "#ffffff",
          fontSize: "24px",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {isAudio ? "Voice Recording" : "Video Recording"}
      </h1>

      {/* Loading indicator */}
      {isLoading && (
        <div
          style={{
            color: "#fff",
            fontSize: "16px",
          }}
        >
          Loading recording...
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
            maxWidth: "600px",
          }}
        >
          {error}
        </div>
      )}

      {/* Video player */}
      {!isAudio && !error && (
        <video
          ref={videoRef}
          controls
          autoPlay
          style={{
            width: "100%",
            maxWidth: "1200px",
            maxHeight: "80vh",
            objectFit: "contain",
            display: isLoading ? "none" : "block",
          }}
          playsInline
        />
      )}

      {/* Audio player */}
      {isAudio && !error && (
        <audio
          ref={audioRef}
          controls
          autoPlay
          style={{
            width: "100%",
            maxWidth: "600px",
            display: isLoading ? "none" : "block",
          }}
        />
      )}
    </div>
  );
}
