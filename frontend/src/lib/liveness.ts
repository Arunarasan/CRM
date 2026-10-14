import type { PoseReading } from '@/lib/faceEngine';

/**
 * A tiny "is a live person in front of the camera" check: the kiosk asks for a blink or a head
 * turn and watches the face landmarks for it. It stops a printed photo or a still image on a
 * screen. It runs in the browser, so it is a deterrent, not proof: the kiosk's selfie on every
 * punch is the audit trail.
 */
export type LivenessKind = 'BLINK' | 'TURN';

export const LIVENESS_PROMPT: Record<LivenessKind, string> = {
  BLINK: 'Blink your eyes',
  TURN: 'Slowly turn your head to one side',
};

/** How far the nose moves off-centre (0.5) to count as a turn. */
const TURN_OFFSET = 0.14;
/** Facing the camera: nose within this of centre. */
export const FRONTAL_OFFSET = 0.09;

export function pickChallenge(): LivenessKind {
  return Math.random() < 0.5 ? 'BLINK' : 'TURN';
}

export class LivenessChallenge {
  private maxEar = 0;
  private openFrames = 0;
  private closed = false;
  private frontalSeen = false;
  private turnedFrames = 0;
  passed = false;

  readonly kind: LivenessKind;

  constructor(kind: LivenessKind) {
    this.kind = kind;
  }

  /** Feed one frame; returns true once the challenge has been met. */
  feed(p: PoseReading): boolean {
    if (this.passed) return true;
    if (this.kind === 'BLINK') {
      // Compare with the widest this person's eyes have been, so it works for narrow and wide eyes alike.
      this.maxEar = Math.max(this.maxEar * 0.995, p.ear);
      const open = p.ear > this.maxEar * 0.85;
      const shut = p.ear < this.maxEar * 0.72;
      if (open) this.openFrames += 1;
      if (this.openFrames >= 4 && shut) this.closed = true;     // was open, now shut
      if (this.closed && open) this.passed = true;              // and open again
    } else {
      const off = Math.abs(p.yaw - 0.5);
      if (off < FRONTAL_OFFSET) this.frontalSeen = true;
      if (this.frontalSeen && off > TURN_OFFSET) this.turnedFrames += 1; else if (off <= TURN_OFFSET) this.turnedFrames = 0;
      if (this.turnedFrames >= 2) this.passed = true;
    }
    return this.passed;
  }
}
