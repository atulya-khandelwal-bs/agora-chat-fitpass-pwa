import { SendHorizontal, SquareStop, Trash2 } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";

const DOT_COUNT = 10;
const BAR_COUNT = 44;

function formatRecordingClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

interface FPAudioRecordingOverlayProps {
  isRecording: boolean;
  isStopped: boolean;
  recordingDuration: number;
  mediaStream: MediaStream | null;
  onCancel: () => void;
  onStop: () => void;
  onSend: () => void;
  formatDuration: (seconds: number) => string;
}

export default function FPAudioRecordingOverlay({
  isRecording,
  isStopped,
  recordingDuration,
  mediaStream,
  onCancel,
  onStop,
  onSend,
}: FPAudioRecordingOverlayProps): React.JSX.Element | null {
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [finalWaveform, setFinalWaveform] = useState<number[]>([]);

  const pushBarsFromAnalyser = useCallback((analyser: AnalyserNode) => {
    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);
    const bars: number[] = [];
    const chunk = Math.max(1, Math.floor(freq.length / BAR_COUNT));
    for (let i = 0; i < BAR_COUNT; i++) {
      let sum = 0;
      for (let j = 0; j < chunk; j++) {
        sum += freq[i * chunk + j] ?? 0;
      }
      const avg = sum / chunk / 255;
      const h = 3 + avg * 26;
      bars.push(Math.min(28, Math.max(3, h)));
    }
    setWaveformData(bars);
    setFinalWaveform(bars);
  }, []);

  useEffect(() => {
    if (!isRecording || !mediaStream) {
      return;
    }

    let ctx: AudioContext | null = null;
    let raf = 0;
    let intervalId: number | null = null;
    let cancelled = false;

    const startFallback = (): void => {
      intervalId = window.setInterval(() => {
        const bars = Array.from(
          { length: BAR_COUNT },
          () => 3 + Math.random() * 22
        );
        setWaveformData(bars);
        setFinalWaveform(bars);
      }, 100);
    };

    const run = async (): Promise<void> => {
      try {
        ctx = new AudioContext();
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        if (cancelled) return;

        const source = ctx.createMediaStreamSource(mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);

        const tick = (): void => {
          if (cancelled) return;
          pushBarsFromAnalyser(analyser);
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        console.error("Audio waveform analyser failed:", e);
        startFallback();
      }
    };

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      void ctx?.close();
    };
  }, [isRecording, mediaStream, pushBarsFromAnalyser]);

  useEffect(() => {
    if (!isRecording && !isStopped) {
      setWaveformData([]);
      setFinalWaveform([]);
    }
  }, [isRecording, isStopped]);

  if (!isRecording && !isStopped) return null;

  const clock = formatRecordingClock(recordingDuration);

  return (
    <div className="audio-recording-overlay audio-recording-overlay--active">
      <div className="audio-recording-waveform-row">
        <div className="audio-recording-silence-dots" aria-hidden>
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <span key={`dot-${i}`} className="audio-recording-silence-dot" />
          ))}
        </div>
        <div className="audio-recording-bars">
          {isStopped ? (
            finalWaveform.length > 0 ? (
              finalWaveform.map((height, i) => (
                <span
                  key={`bar-${i}`}
                  className="audio-recording-bar"
                  style={{ height: `${height}px` }}
                />
              ))
            ) : (
              Array.from({ length: BAR_COUNT }).map((_, i) => (
                <span
                  key={`bar-f-${i}`}
                  className="audio-recording-bar"
                  style={{ height: `${4 + (i % 5) * 3}px` }}
                />
              ))
            )
          ) : waveformData.length > 0 ? (
            waveformData.map((height, i) => (
              <span
                key={`bar-${i}`}
                className="audio-recording-bar"
                style={{ height: `${height}px` }}
              />
            ))
          ) : (
            Array.from({ length: BAR_COUNT }).map((_, i) => (
              <span
                key={`bar-p-${i}`}
                className="audio-recording-bar audio-recording-bar--idle"
                style={{ height: "4px" }}
              />
            ))
          )}
        </div>
      </div>

      <div className="audio-recording-timer-pill">{clock}</div>

      <div className="audio-recording-bottom-actions">
        <div className="audio-recording-labeled-action">
          <button
            type="button"
            className="audio-recording-circle-btn audio-recording-circle-btn--red"
            onClick={onCancel}
            aria-label="Delete recording"
          >
            <Trash2 size={22} color="#FFFFFF" strokeWidth={2.25} />
          </button>
          <span className="audio-recording-action-label">Delete</span>
        </div>
        <div className="audio-recording-labeled-action">
          {isStopped ? (
            <>
              <button
                type="button"
                className="audio-recording-circle-btn audio-recording-circle-btn--red"
                onClick={() => {
                  void onSend();
                }}
                aria-label="Send recording"
              >
                <SendHorizontal size={22} color="#FFFFFF" strokeWidth={2.25} />
              </button>
              <span className="audio-recording-action-label">Send</span>
            </>
          ) : (
            <>
              <button
                type="button"
                className="audio-recording-circle-btn audio-recording-circle-btn--red"
                onClick={onStop}
                aria-label="Stop recording"
              >
                <SquareStop size={22} color="#FFFFFF" strokeWidth={2.25} />
              </button>
              <span className="audio-recording-action-label">Stop</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
