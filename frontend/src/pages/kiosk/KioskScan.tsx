/**
 * One face check on the kiosk: opens the camera, waits for a single clear face, asks for a blink or a
 * head turn (liveness), then grabs a straight-on frame, builds its face signature and a selfie, and
 * sends them to the server, which identifies the employee and records the punch. The camera is
 * closed as soon as the frame is taken.
 */
import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { kioskApi, KioskPunchResult } from '@/lib/kioskApi';
import { attachWarmCamera, faceDistance, leaveCamera, loadFaceEngine, scanFace, scanPose, snapshot } from '@/lib/faceEngine';
import { FRONTAL_OFFSET, LIVENESS_PROMPT, LivenessChallenge, pickChallenge } from '@/lib/liveness';

export type ScanAction = 'IN' | 'OUT';

export interface ScanDone {
  result: KioskPunchResult;
  /** The selfie that was sent, for showing on the result card. */
  selfie: Blob | null;
  /** True when the punch was typed in by ID / phone with a photo (waiting for admin approval). */
  manual?: boolean;
}

export interface ScanFail {
  message: string;
  /** HTTP status when the server refused (401/403 mean the kiosk must be paired again). */
  status?: number;
}

type Stage = 'loading' | 'find' | 'challenge' | 'capture' | 'sending';

/** Face must fill at least this share of the frame width before we trust a reading. */
const MIN_SHARE = 0.28;
/** Clear frames averaged into one signature, and how far apart two frames of one steady face may be. */
const GOOD_FRAMES = 2;
const SAME_FRAME_MAX = 0.3;
const CHALLENGE_MS = 9000;
/**
 * Ask for a blink / head turn before the punch. Off for speed: a check is just "show your face"
 * (about 2-3 s). Every punch still stores its selfie for HR, and the server flags weak matches.
 */
const REQUIRE_LIVENESS = false;
const TOTAL_MS = 45000;

const nextFrame = () => new Promise<void>((res) => requestAnimationFrame(() => res()));

export default function KioskScan({ action, onDone, onFail, onCancel, onSwitch, onManual }: {
  action: ScanAction;
  onDone: (d: ScanDone) => void;
  onFail: (f: ScanFail) => void;
  onCancel: () => void;
  /** Shown when the kiosk also accepts fingerprints and the sensor is connected. */
  onSwitch?: () => void;
  /** Fallback when the face can't be read: employee ID / phone + photo, needs admin approval. */
  onManual?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stage, setStage] = useState<Stage>('loading');
  const [hint, setHint] = useState('Starting camera…');
  // The callbacks come from a parent that re-renders every second (clock); keep the latest in refs.
  const doneRef = useRef(onDone);
  const failRef = useRef(onFail);
  doneRef.current = onDone;
  failRef.current = onFail;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    const run = async () => {
      try {
        // Camera and models are warmed while the kiosk idles; these resolve at once in that case.
        const video = videoRef.current;
        const [, cam] = await Promise.all([loadFaceEngine(), video ? attachWarmCamera(video) : Promise.resolve(null)]);
        if (!video || cancelled) { leaveCamera(cam, video); return; }
        stream = cam;
        if (cancelled) return;

        const started = Date.now();
        let stg: Stage = 'find';
        setStage('find'); setHint('Look at the camera');
        let okFrames = 0;
        const good: number[][] = [];
        let steady = 0;
        let challenge: LivenessChallenge | null = null;
        let challengeStart = 0;

        while (!cancelled) {
          if (Date.now() - started > TOTAL_MS) { failRef.current({ message: 'Timed out. Tap Check In or Check Out and try again.' }); return; }
          await nextFrame();
          if (!REQUIRE_LIVENESS) {
            // Fast path: ONE pass per frame (detect + landmarks + face signature). Two clear, straight-on
            // frames that agree with each other are averaged into one signature (less noise = a more
            // reliable match), then sent at once. A frame that disagrees (blur / movement) is dropped.
            const f = await scanFace(video, 224);
            if (cancelled) return;
            if (f.state === 'none') { setHint('Look at the camera'); continue; }
            if (f.state === 'multiple') { setHint('One person at a time, please'); continue; }
            const r = f.reading;
            if (r.box.width / r.frameWidth < MIN_SHARE) { setHint('Come a little closer'); continue; }
            if (r.score < 0.8) { setHint('Face the camera'); continue; }
            if (Math.abs(r.yaw - 0.5) >= FRONTAL_OFFSET) { setHint('Look straight at the camera'); continue; }
            if (good.length > 0 && faceDistance(good[0], r.descriptor) > SAME_FRAME_MAX) good.length = 0; // unsteady: start over
            good.push(r.descriptor);
            if (good.length < GOOD_FRAMES) { setHint('Hold still…'); continue; }
            const descriptor = good[0].map((_, i) => good.reduce((sum, d) => sum + d[i], 0) / good.length);
            setStage('sending'); setHint('Checking…');
            const selfie = await snapshot(video, 0.7, 360);
            leaveCamera(stream, video); stream = null;
            try {
              const result = await kioskApi.punch(action, descriptor, selfie, null);
              if (!cancelled) doneRef.current({ result, selfie });
            } catch (e: any) {
              if (cancelled) return;
              const status = e?.response?.status as number | undefined;
              failRef.current({
                status,
                message: e?.response?.data?.message || (status ? 'The server refused this check.' : 'Cannot reach the server. Check the internet and try again.'),
              });
            }
            return;
          }
          const scan = await scanPose(video);
          if (cancelled) return;
          if (scan.state === 'none') { okFrames = 0; steady = 0; if (stg === 'find') setHint('Look at the camera'); continue; }
          if (scan.state === 'multiple') { okFrames = 0; steady = 0; setHint('One person at a time, please'); continue; }
          const pose = scan.pose;

          if (pose.share < MIN_SHARE) { okFrames = 0; steady = 0; setHint('Come a little closer'); continue; }
          if (pose.score < 0.6) { okFrames = 0; steady = 0; setHint('Face the camera'); continue; }

          if (stg === 'find' && !REQUIRE_LIVENESS) {
            // Fast path: no blink/turn to perform. Two steady, straight-on frames and we capture.
            const frontal = Math.abs(pose.yaw - 0.5) < FRONTAL_OFFSET && pose.score >= 0.7;
            steady = frontal ? steady + 1 : 0;
            if (!frontal) { setHint('Look straight at the camera'); continue; }
            if (steady < 2) { setHint('Hold still…'); continue; }
            stg = 'capture';
            setStage('capture'); setHint('Checking…');
          } else if (stg === 'find') {
            okFrames += 1;
            if (okFrames >= 2) {
              challenge = new LivenessChallenge(pickChallenge());
              challengeStart = Date.now();
              stg = 'challenge';
              setStage('challenge'); setHint(LIVENESS_PROMPT[challenge.kind]);
            } else setHint('Hold still…');
          } else if (stg === 'challenge' && challenge) {
            if (challenge.feed(pose)) {
              stg = 'capture'; steady = 0;
              setStage('capture'); setHint('Now look straight at the camera');
            } else if (Date.now() - challengeStart > CHALLENGE_MS) {
              failRef.current({ message: 'Could not confirm a live face. Please try again.' });
              return;
            }
          } else if (stg === 'capture') {
            if (REQUIRE_LIVENESS) {
              const frontal = Math.abs(pose.yaw - 0.5) < FRONTAL_OFFSET;
              steady = frontal && pose.score >= 0.7 ? steady + 1 : 0;
              if (steady < 2) continue;
            }

            const full = await scanFace(video);
            if (cancelled) return;
            if (full.state !== 'one') { steady = 0; if (!REQUIRE_LIVENESS) { stg = 'find'; setStage('find'); } continue; }
            const selfie = await snapshot(video, 0.7, 360);
            leaveCamera(stream, video); stream = null; // frame taken: stop showing it (the warm camera stays on)
            setStage('sending'); setHint('Checking…');
            try {
              const result = await kioskApi.punch(action, full.reading.descriptor, selfie, challenge?.kind ?? null);
              if (!cancelled) doneRef.current({ result, selfie });
            } catch (e: any) {
              if (cancelled) return;
              const status = e?.response?.status as number | undefined;
              failRef.current({
                status,
                message: e?.response?.data?.message || (status ? 'The server refused this check.' : 'Cannot reach the server. Check the internet and try again.'),
              });
            }
            return;
          }
        }
      } catch (e: any) {
        if (!cancelled) failRef.current({ message: e?.message || 'Could not start the camera.' });
      }
    };
    run();
    return () => { cancelled = true; leaveCamera(stream, videoRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{action === 'IN' ? 'Check In' : 'Check Out'}</span>
        <button onClick={onCancel} aria-label="Cancel" className="rounded-full bg-white/15 p-2"><X className="h-5 w-5" /></button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
        {/* oval guide */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className={`h-[58%] w-[70%] max-w-sm rounded-[50%] border-4 ${stage === 'capture' ? 'border-emerald-400' : stage === 'challenge' ? 'border-amber-300' : 'border-white/70'}`} />
        </div>
        {(stage === 'loading' || stage === 'sending') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-lg font-semibold">{hint}</p>
          </div>
        )}
      </div>

      <div className="px-4 pb-8 pt-4 text-center">
        <p className="text-2xl font-bold">{stage === 'loading' || stage === 'sending' ? '' : hint}</p>
        {stage === 'challenge' && <p className="mt-1 text-sm text-white/70">This makes sure it is a real person</p>}
        {onManual && stage !== 'sending' && stage !== 'loading' && (
          <button onClick={onManual} className="mt-3 block w-full text-sm text-white/80 underline">Can’t scan? Use employee ID or phone</button>
        )}
        {onSwitch && stage !== 'sending' && (
          <button onClick={onSwitch} className="mt-3 rounded-full bg-white/15 px-5 py-2 text-sm font-semibold">Use fingerprint instead</button>
        )}
      </div>
    </div>
  );
}
