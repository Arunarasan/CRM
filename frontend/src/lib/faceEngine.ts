/**
 * In-browser face recognition for kiosk attendance, on @vladmandic/face-api. Everything runs on the
 * device: a camera frame becomes a 128-number descriptor, and two descriptors of the same person
 * are close in Euclidean distance (about 0.2-0.45; 0.6 is the library's "different person" limit).
 *
 * The library (~1.3 MB) and the three small models (~6.7 MB, self-hosted under /models/face so the
 * kiosk never depends on a CDN) are loaded lazily the first time a camera screen asks for them.
 */

type FaceApi = typeof import('@vladmandic/face-api');

let enginePromise: Promise<FaceApi> | null = null;

const MODEL_URL = `${import.meta.env.BASE_URL}models/face`;

/** Loads the library and models once; later calls reuse the same promise. */
export function loadFaceEngine(): Promise<FaceApi> {
  if (!enginePromise) {
    enginePromise = (async () => {
      const faceapi = await import('@vladmandic/face-api');
      const tf = (faceapi as any).tf; // the bundled TensorFlow.js; its typings are not exported
      try {
        await tf.setBackend('webgl');
      } catch {
        await tf.setBackend('cpu'); // no WebGL (old phone / headless): slower but works
      }
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      await warmUp(faceapi);
      return faceapi;
    })().catch((e) => {
      enginePromise = null; // allow a retry after a network failure
      throw e;
    });
  }
  return enginePromise;
}

/**
 * One dummy pass through each network so TensorFlow compiles its WebGL shaders now, while the kiosk
 * is idle, instead of during the first person's scan. A blank frame has no face, so the landmark and
 * recognition nets are fed directly with correctly sized canvases.
 */
async function warmUp(faceapi: FaceApi): Promise<void> {
  try {
    const blank = (size: number) => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const g = c.getContext('2d');
      if (g) { g.fillStyle = '#808080'; g.fillRect(0, 0, size, size); }
      return c;
    };
    await faceapi.detectAllFaces(blank(320), new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }));
    await faceapi.detectAllFaces(blank(224), new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }));
    await faceapi.nets.faceLandmark68TinyNet.detectLandmarks(blank(112));
    await faceapi.nets.faceRecognitionNet.computeFaceDescriptor(blank(150));
  } catch { /* warm-up is best effort */ }
}

export interface FaceBox { x: number; y: number; width: number; height: number }

export interface FaceReading {
  descriptor: number[];
  /** Nose position between the jaw edges (0.5 = facing the camera). */
  yaw: number;
  /** Detector confidence, 0..1. */
  score: number;
  box: FaceBox;
  frameWidth: number;
  frameHeight: number;
}

export type FaceScan =
  | { state: 'none' }
  | { state: 'multiple'; count: number }
  | { state: 'one'; reading: FaceReading };

/** Detects faces in the current video frame; computes a descriptor only when exactly one is found. */
export async function scanFace(video: HTMLVideoElement, inputSize = 320): Promise<FaceScan> {
  const faceapi = await loadFaceEngine();
  if (video.readyState < 2 || !video.videoWidth) return { state: 'none' };
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.5 });
  const found = await faceapi.detectAllFaces(video, options).withFaceLandmarks(true).withFaceDescriptors();
  if (found.length === 0) return { state: 'none' };
  if (found.length > 1) return { state: 'multiple', count: found.length };
  const f = found[0];
  const b = f.detection.box;
  const lp = f.landmarks.positions;
  return {
    state: 'one',
    reading: {
      yaw: (lp[30].x - lp[0].x) / (lp[16].x - lp[0].x || 1),
      descriptor: Array.from(f.descriptor),
      score: f.detection.score,
      box: { x: b.x, y: b.y, width: b.width, height: b.height },
      frameWidth: video.videoWidth,
      frameHeight: video.videoHeight,
    },
  };
}

/** Lightweight per-frame reading (no descriptor): where the face is, how open the eyes are, which way the head points. */
export interface PoseReading {
  score: number;
  /** Face width as a share of the frame width (0..1): how close the person stands. */
  share: number;
  /** Face centre, as a share of the frame (0..1). */
  cx: number;
  cy: number;
  /** Eye aspect ratio, averaged over both eyes: about 0.3 open, below 0.2 closed. */
  ear: number;
  /** Nose position between the jaw edges: about 0.5 facing the camera, toward 0 or 1 when turned. */
  yaw: number;
}

export type PoseScan =
  | { state: 'none' }
  | { state: 'multiple' }
  | { state: 'one'; pose: PoseReading };

/** Fast frame check used for the liveness challenge (detector + landmarks only, no recognition net). */
export async function scanPose(video: HTMLVideoElement): Promise<PoseScan> {
  const faceapi = await loadFaceEngine();
  if (video.readyState < 2 || !video.videoWidth) return { state: 'none' };
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  const found = await faceapi.detectAllFaces(video, options).withFaceLandmarks(true);
  if (found.length === 0) return { state: 'none' };
  if (found.length > 1) return { state: 'multiple' };
  const f = found[0];
  const p = f.landmarks.positions;
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  const ear = (i: number) => (dist(p[i + 1], p[i + 5]) + dist(p[i + 2], p[i + 4])) / (2 * dist(p[i], p[i + 3]) || 1);
  const jawSpan = p[16].x - p[0].x || 1;
  const b = f.detection.box;
  return {
    state: 'one',
    pose: {
      score: f.detection.score,
      share: b.width / video.videoWidth,
      cx: (b.x + b.width / 2) / video.videoWidth,
      cy: (b.y + b.height / 2) / video.videoHeight,
      ear: (ear(36) + ear(42)) / 2,
      yaw: (p[30].x - p[0].x) / jawSpan,
    },
  };
}

export function faceDistance(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/** Opens the front camera on a <video>. Needs HTTPS or localhost; throws a readable Error otherwise. */
export async function startFrontCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('The camera needs a secure (https) connection. Open the CRM over https.');
  }
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch (e: any) {
    if (e?.name === 'NotAllowedError') throw new Error('Camera permission was blocked. Allow camera access and try again.');
    if (e?.name === 'NotFoundError') throw new Error('No camera found on this device.');
    throw new Error('Could not start the camera.');
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});
  return stream;
}

let sharedStream: MediaStream | null = null;

/**
 * Kiosk only: opens the front camera once and keeps it running between punches, so a tap does not
 * wait for the camera to start. Safe to call repeatedly; returns the live stream (or null if it
 * could not be opened).
 */
export async function keepCameraWarm(): Promise<MediaStream | null> {
  if (sharedStream && sharedStream.getVideoTracks().some((t) => t.readyState === 'live')) return sharedStream;
  try {
    sharedStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
  } catch {
    sharedStream = null;
  }
  return sharedStream;
}

/** Shows the warm camera on a <video>; falls back to opening the camera if it was not kept warm. */
export async function attachWarmCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await keepCameraWarm();
  if (!stream) return startFrontCamera(video);
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});
  return stream;
}

/** Ends a scan: keeps the warm camera running, but really stops any camera opened just for the scan. */
export function leaveCamera(stream: MediaStream | null | undefined, video?: HTMLVideoElement | null) {
  if (!stream) return;
  if (stream === sharedStream) { if (video) video.srcObject = null; return; }
  stopCamera(stream);
}

export function releaseWarmCamera() {
  stopCamera(sharedStream);
  sharedStream = null;
}

export function stopCamera(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** JPEG snapshot of the current video frame, scaled down so a selfie stays small. */
export function snapshot(video: HTMLVideoElement, quality = 0.85, maxWidth = 640): Promise<Blob | null> {
  const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}
