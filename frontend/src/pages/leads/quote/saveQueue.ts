// One save at a time per quote sheet. The sheet (items, materials, labour) and the price cards under
// it (discount, GST, final price) both write the same BOQ, and the server rejects the second of two
// overlapping writes as a version conflict — so a product added while the final price was saving
// (or the reverse) was silently lost. Every writer on the page chains onto this queue instead.

const queues = new Map<number, Promise<unknown>>();

/** Runs `job` after every earlier save for this sheet has finished (whether it succeeded or not). */
export function enqueueSave<T>(boqId: number, job: () => Promise<T>): Promise<T> {
  const prev = queues.get(boqId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(job);
  const tail = run.catch(() => undefined);
  queues.set(boqId, tail);
  // Drop the entry once the queue drains so finished sheets don't linger.
  tail.then(() => { if (queues.get(boqId) === tail) queues.delete(boqId); });
  return run;
}
