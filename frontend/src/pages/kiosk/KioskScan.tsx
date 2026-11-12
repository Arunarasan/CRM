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
/** ...and not so big it overflows the oval; its centre must sit near the middle of the oval (the oval is centred on screen). */
const MAX_SHARE = 0.75;
const CENTRE_TOLERANCE_X = 0.14;
const CENTRE_TOLERANCE_Y = 0.16;
/** Clear frames averaged into one signature, and how far apart two frames of one steady face may be. */
const GOOD_FRAMES = 4;
/** A frame this far from the average of the frames so far is a blur / movement: dropped, not counted. */
const SAME_FRAME_MAX = 0.35;
/** Gap between counted frames: 4 separate looks take ~3-4 s: quick, yet steadier than a single frame. */
const FRAME_GAP_MS = 500;
/** After this long since the first good frame, go with what we have if at least MIN_FRAMES agree (keeps it under ~10 s). */
const MAX_CAPTURE_MS = 3500;
const MIN_FRAMES = 3;
const MIN_DETECT_SCORE = 0.85;
/** Detector input size: larger = a sharper face crop for the recognition net, a little slower per frame. */
const DETECT_SIZE = 256;
const CHALLENGE_MS = 9000;
/**
 * Ask for a blink / head turn before the punch. Off for speed: a check is just "show your face"
 * (about 3-4 s). Every punch still stores its selfie for HR, and the server flags weak matches.
 */
const REQUIRE_LIVENESS = false;
const TOTAL_MS = 45000;

const mean = (vs: number[][]) => vs[0].map((_, i) => vs.reduce((sum, d) => sum + d[i], 0) / vs.length);
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
  // The oval is the live signal: white = no face yet, red = adjust (move / hold still), green = good, and it fills as frames are captured.
  const [ring, setRing] = useState<{ tone: 'idle' | 'bad' | 'good'; p: number }>({ tone: 'idle', p: 0 });
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
        let lastGoodAt = 0;
        const show = (tone: 'idle' | 'bad' | 'good') => setRing({ tone, p: Math.min(1, good.length / GOOD_FRAMES) });
        let firstGoodAt = 0;
        let rejects = 0;
        let steady = 0;
        let challenge: LivenessChallenge | null = null;
        let challengeStart = 0;

        while (!cancelled) {
          if (Date.now() - started > TOTAL_MS) { failRef.current({ message: 'Timed out. Tap Check In or Check Out and try again.' }); return; }
          await nextFrame();
          if (!REQUIRE_LIVENESS) {
            // Fast path: ONE pass per frame (detect + landmarks + face signature). Up to 4 clear, straight-on
            // frames, ~0.5 s apart, are gathered (about 3-4 s in all). A frame far from the others (blur /
            // movement) is dropped; the worst remaining frame is then discarded and the rest averaged into
            // one signature, so one bad frame can't cause a wrong-person match.
            const f = await scanFace(video, DETECT_SIZE);
            if (cancelled) return;
            if (f.state === 'none') { show('idle'); setHint('Look at the camera'); continue; }
            if (f.state === 'multiple') { show('bad'); setHint('One person at a time, please'); continue; }
            const r = f.reading;
            const share = r.box.width / r.frameWidth;
            const cx = (r.box.x + r.box.width / 2) / r.frameWidth;
            const cy = (r.box.y + r.box.height / 2) / r.frameHeight;
            const inOval = share >= MIN_SHARE && share <= MAX_SHARE
              && Math.abs(cx - 0.5) <= CENTRE_TOLERANCE_X && Math.abs(cy - 0.5) <= CENTRE_TOLERANCE_Y;
            if (share < MIN_SHARE) { show('bad'); setHint('Come a little closer'); continue; }
            if (share > MAX_SHARE) { show('bad'); setHint('Move back a little'); continue; }
            if (!inOval) { show('bad'); setHint('Put your face inside the oval'); continue; }
            if (r.score < MIN_DETECT_SCORE) { show('bad'); setHint('Face the camera'); continue; }
            if (Math.abs(r.yaw - 0.5) >= FRONTAL_OFFSET) { show('bad'); setHint('Look straight at the camera'); continue; }
            show('good');
            if (Date.now() - lastGoodAt < FRAME_GAP_MS) continue; // wait between counted frames
            if (good.length > 0) {
              const c = mean(good);
              if (faceDistance(c, r.descriptor) > SAME_FRAME_MAX) {
                // Disagrees with the frames so far. Three in a row means a different face took over: start again.
                if (++rejects >= 3) { good.length = 0; rejects = 0; firstGoodAt = 0; }
                show('bad'); setHint('Hold still…');
                continue;
              }
            }
            rejects = 0;
            if (good.length === 0) firstGoodAt = Date.now();
            good.push(r.descriptor);
            lastGoodAt = Date.now();
            show('good');
            const waited = Date.now() - firstGoodAt;
            if (good.length < GOOD_FRAMES && !(good.length >= MIN_FRAMES && waited >= MAX_CAPTURE_MS)) {
              setHint(`Hold still… ${good.length}/${GOOD_FRAMES}`);
              continue;
            }
            // Drop the frame farthest from the average, then average the rest.
            const centre = mean(good);
            let worst = 0;
            good.forEach((d, i) => { if (faceDistance(d, centre) > faceDistance(good[worst], centre)) worst = i; });
            const descriptor = mean(good.filter((_, i) => i !== worst));
            setRing({ tone: 'good', p: 1 });
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
          <div className="relative h-[58%] w-[70%] max-w-sm">
            <svg viewBox="0 0 100 130" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <ellipse cx="50" cy="65" rx="48" ry="63" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="5" vectorEffect="non-scaling-stroke" />
              <path d="M50,2 A48,63 0 1,1 49.99,2" pathLength={100} fill="none" strokeLinecap="round" strokeWidth="9" vectorEffect="non-scaling-stroke"
                stroke={ring.tone === 'good' ? '#34d399' : ring.tone === 'bad' ? '#f87171' : '#ffffff'}
                strokeDasharray={`${ring.tone === 'idle' && ring.p === 0 ? 0 : Math.max(ring.p * 100, 2)} 100`}
                style={{ transition: 'stroke-dasharray 0.45s linear, stroke 0.15s' }} />
            </svg>
          </div>
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
