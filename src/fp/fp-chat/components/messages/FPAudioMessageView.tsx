import React, { RefObject } from "react";

interface FPAudioMessageViewProps {
  audioUrl: string;
  audioTranscription?: string;
  currentlyPlayingAudioRef: RefObject<HTMLAudioElement | null>;
}

export default function FPAudioMessageView({
  audioUrl,
  audioTranscription,
  currentlyPlayingAudioRef,
}: FPAudioMessageViewProps): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
      }}
    >
      <audio
        className="fp-audio"
        controls
        src={audioUrl}
        onPlay={(e) => {
          // Pause the previously playing audio if any
          if (
            currentlyPlayingAudioRef.current &&
            currentlyPlayingAudioRef.current !== e.target
          ) {
            currentlyPlayingAudioRef.current.pause();
          }
          // Set the current audio as the playing one
          currentlyPlayingAudioRef.current = e.target as HTMLAudioElement;
        }}
        onEnded={(e) => {
          // Clear the reference when audio ends
          if (currentlyPlayingAudioRef.current === e.target) {
            currentlyPlayingAudioRef.current = null;
          }
        }}
        onPause={(e) => {
          // Clear the reference when audio is paused
          if (currentlyPlayingAudioRef.current === e.target) {
            currentlyPlayingAudioRef.current = null;
          }
        }}
      />
      {audioTranscription && (
        <div
          style={{
            fontSize: "0.75rem",
            color: "#6b7280",
          }}
        >
          {audioTranscription}
        </div>
      )}
    </div>
  );
}
