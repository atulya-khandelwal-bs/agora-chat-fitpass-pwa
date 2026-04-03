import React, {
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface FPAudioMessageViewProps {
  audioUrl: string;
  currentlyPlayingAudioRef: RefObject<HTMLAudioElement | null>;
  isIncoming: boolean;
}

export default function FPAudioMessageView({
  audioUrl,
  currentlyPlayingAudioRef,
  isIncoming,
}: FPAudioMessageViewProps): React.JSX.Element {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);
  }, [audioUrl]);

  const syncDuration = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    const d = el.duration;
    if (Number.isFinite(d)) setDuration(d);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
  }, []);

  const handlePlay = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      const target = e.target as HTMLAudioElement;
      if (
        currentlyPlayingAudioRef.current &&
        currentlyPlayingAudioRef.current !== target
      ) {
        currentlyPlayingAudioRef.current.pause();
      }
      currentlyPlayingAudioRef.current = target;
      setPlaying(true);
    },
    [currentlyPlayingAudioRef],
  );

  const handlePause = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (currentlyPlayingAudioRef.current === e.target) {
        currentlyPlayingAudioRef.current = null;
      }
      setPlaying(false);
    },
    [currentlyPlayingAudioRef],
  );

  const handleEnded = useCallback(
    (e: React.SyntheticEvent<HTMLAudioElement>) => {
      if (currentlyPlayingAudioRef.current === e.target) {
        currentlyPlayingAudioRef.current = null;
      }
      setPlaying(false);
      setCurrentTime(0);
    },
    [currentlyPlayingAudioRef],
  );

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play().catch(() => setPlaying(false));
    }
  }, [playing]);

  const onSeekChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const el = audioRef.current;
      if (!el) return;
      const t = Number(e.target.value);
      el.currentTime = t;
      setCurrentTime(t);
    },
    [],
  );

  const max = duration > 0 ? duration : 1;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const mod = isIncoming ? "incoming" : "outgoing";

  return (
    <div className={`fp-audio-player fp-audio-player--${mod}`}>
      <audio
        ref={audioRef}
        className="fp-audio-player__media"
        src={audioUrl}
        preload="metadata"
        playsInline
        onLoadedMetadata={syncDuration}
        onDurationChange={syncDuration}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
      />
      <button
        type="button"
        className="fp-audio-player__play"
        onClick={togglePlay}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <svg width="24" height="24" viewBox="0 0 14 14" aria-hidden>
          <rect x="2" y="2" width="3" height="10" rx="1" fill="currentColor" />
          <rect x="9" y="2" width="3" height="10" rx="1" fill="currentColor" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 14 14" aria-hidden>
            <path
              d="M3.6 2.4 L11.4 7 L3.6 11.6 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      <input
        type="range"
        className="fp-audio-player__seek"
        min={0}
        max={max}
        step={0.01}
        value={Math.min(currentTime, max)}
        onChange={onSeekChange}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={duration > 0 ? duration : 0}
        aria-valuenow={currentTime}
        style={
          {
            "--fp-audio-progress": `${progressPct}%`,
          } as React.CSSProperties
        }
      />
      <span className="fp-audio-player__time">
        {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
      </span>
    </div>
  );
}
