import { useEffect, useRef, useState } from "react";
import { Play, Pause, Download, AlertTriangle, Loader2 } from "lucide-react";

/**
 * Compact in-app audio player used everywhere a voice note / call recording is shown. Replaces the
 * native <audio controls>, which renders a dead "0:00 / 0:00" bar when the browser can't decode the
 * file (phone-call .amr/.3gp) and never shows a length for in-browser webm recordings (no duration
 * in the header). This one: shows the file name, works out the real length of webm clips, and when a
 * file can't play it says so and offers a download instead of a broken bar.
 */
export default function AudioPlayer({
  src, fileName, autoPlay, className = "", failedAction,
}: {
  src: string;
  fileName?: string;
  autoPlay?: boolean;
  className?: string;
  /** Extra button shown next to Download when the file can't play (e.g. "Make playable"). */
  failedAction?: React.ReactNode;
}) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const fixingRef = useRef(false);

  useEffect(() => {
    setPlaying(false); setTime(0); setDuration(0); setReady(false); setFailed(false);
  }, [src]);

  const onLoaded = () => {
    const a = ref.current;
    if (!a) return;
    if (Number.isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration);
      setReady(true);
      return;
    }
    // webm from MediaRecorder carries no duration: seeking far past the end makes the browser scan
    // the file and report the real length, then we jump back to the start.
    fixingRef.current = true;
    a.currentTime = 1e9;
  };

  const onDurationChange = () => {
    const a = ref.current;
    if (!a || !Number.isFinite(a.duration) || a.duration <= 0) return;
    setDuration(a.duration);
    if (fixingRef.current) {
      fixingRef.current = false;
      a.currentTime = 0;
    }
    setReady(true);
  };

  const toggle = async () => {
    const a = ref.current;
    if (!a) return;
    if (a.paused) {
      try {
        await a.play();
      } catch (e: any) {
        // Only an unsupported source means the file can't play; an interrupted/blocked play can be retried.
        if (e?.name === "NotSupportedError") setFailed(true);
      }
    } else {
      a.pause();
    }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = Number(e.target.value);
    setTime(a.currentTime);
  };

  const fmt = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };

  if (failed) {
    return (
      <div className={`flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-amber-900 ${className}`}>
        <div className="flex min-w-[160px] flex-1 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            {fileName && <p className="truncate text-xs font-medium">{fileName}</p>}
            <p className="text-xs">This audio format can't play in the browser.</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {failedAction}
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            download
            className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-100"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>
      </div>
    );
  }

  const progress = duration > 0 ? Math.min(100, (time / duration) * 100) : 0;

  return (
    <div className={`flex min-w-0 items-center gap-2.5 ${className}`}>
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        onLoadedMetadata={onLoaded}
        onDurationChange={onDurationChange}
        onTimeUpdate={() => { if (!fixingRef.current) setTime(ref.current?.currentTime ?? 0); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setTime(0); if (ref.current) ref.current.currentTime = 0; }}
        onError={() => setFailed(true)}
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "Pause" : "Play"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity disabled:opacity-50"
      >
        {!ready ? <Loader2 className="h-4 w-4 animate-spin" />
          : playing ? <Pause className="h-4 w-4 fill-current" />
          : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="min-w-0 flex-1">
        {fileName && <p className="truncate text-xs font-medium text-foreground">{fileName}</p>}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            onChange={seek}
            disabled={!ready}
            aria-label="Seek"
            className="h-1.5 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}%)` }}
          />
          <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">
            {fmt(time)} / {ready ? fmt(duration) : "--:--"}
          </span>
        </div>
      </div>
    </div>
  );
}
