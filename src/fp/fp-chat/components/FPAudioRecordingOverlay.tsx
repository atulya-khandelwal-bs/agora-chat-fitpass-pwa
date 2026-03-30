import { SendHorizontal, SquareStop, Trash2 } from "lucide-react";
import React, { useState, useEffect } from "react";

interface FPAudioRecordingOverlayProps {
  isRecording: boolean;
  isStopped: boolean;
  recordingDuration: number;
  onCancel: () => void;
  onStop: () => void;
  onSend: () => void;
  formatDuration: (seconds: number) => string;
}

export default function FPAudioRecordingOverlay({
  isRecording,
  isStopped,
  recordingDuration,
  onCancel,
  onStop,
  onSend,
  formatDuration,
}: FPAudioRecordingOverlayProps): React.JSX.Element | null {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [finalWaveform, setFinalWaveform] = useState<number[]>([]);

  // Simulate waveform data (in real app, this would come from audio analysis)
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        // Generate random waveform bars (heights between 4-24px)
        const newBars = Array.from(
          { length: 25 },
          () => Math.random() * 20 + 4
        );
        setWaveformData(newBars);
        setFinalWaveform(newBars); // Keep updating final waveform while recording
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isRecording]);

  // Don't show if neither recording nor stopped
  if (!isRecording && !isStopped) return null;

  return (
    <div
      className="audio-recording-overlay"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#FCE7F3",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        {/* Timestamp */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "#374151",
            minWidth: "45px",
            flexShrink: 0,
          }}
        >
          {formatDuration(recordingDuration)}
        </div>

        {/* Audio Waveform Bar */}
        <div
          style={{
            flex: 1,
            height: "48px",
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "24px",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "3px",
            overflow: "hidden",
          }}
        >
          {isStopped ? (
            /* Static waveform when stopped */
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "2px",
                height: "100%",
                flex: 1,
              }}
            >
              {finalWaveform.length > 0
                ? finalWaveform.map((height, i) => (
                    <div
                      key={`bar-${i}`}
                      style={{
                        width: "3px",
                        height: `${height}px`,
                        background: "#DC4144",
                        borderRadius: "2px",
                      }}
                    />
                  ))
                : Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={`bar-${i}`}
                style={{
                        width: "3px",
                        height: `${Math.random() * 20 + 4}px`,
                  background: "#DC4144",
                        borderRadius: "2px",
                }}
              />
                  ))}
            </div>
          ) : (
            <>
              {/* Dotted line for silence (first part) */}
              <div
                style={{
                  display: "flex",
                  gap: "4px",
                  alignItems: "center",
                  height: "100%",
                  marginRight: "8px",
                }}
              >
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={`dot-${i}`}
                    style={{
                      width: "3px",
                      height: "3px",
                      borderRadius: "50%",
                      background: "#DC4144",
                    }}
                  />
                ))}
              </div>

              {/* Waveform bars */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "2px",
                  height: "100%",
                  flex: 1,
                }}
              >
                {waveformData.length > 0
                  ? waveformData.map((height, i) => (
                      <div
                        key={`bar-${i}`}
                        style={{
                          width: "3px",
                          height: `${height}px`,
                          background: "#DC4144",
                          borderRadius: "2px",
                          transition: "height 0.1s ease-out",
                        }}
                      />
                    ))
                  : Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={`bar-${i}`}
                        style={{
                          width: "3px",
                          height: "4px",
                          background: "#DC4144",
                          borderRadius: "2px",
                        }}
                      />
                    ))}
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          {/* Delete/Trash Button */}
          <button
            onClick={onCancel}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              background: "#DC4144",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "opacity 0.2s",
              padding: 0,
              color: "#FFFFFF",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = "0.8";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = "1";
            }}
          >
            <Trash2 size={20} color="#FFFFFF" />
          </button>

          {/* Stop or Send Button */}
          {isStopped ? (
            /* Send Button - shown after stopping */
            <button
              onClick={onSend}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#DC4144",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s",
                padding: 0,
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <SendHorizontal size={20} />
            </button>
          ) : (
            /* Stop Button - shown while recording */
            <button
              onClick={onStop}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "#DC4144",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "opacity 0.2s",
                padding: 0,
                color: "#FFFFFF",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "1";
              }}
            >
              <SquareStop size={20} color="#FFFFFF" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
