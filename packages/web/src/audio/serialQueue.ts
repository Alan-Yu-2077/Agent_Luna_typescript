// A minimal serial task queue: tasks enqueued (even concurrently, mid-flight) run
// strictly one after another — the next starts only after the previous fully
// settles. This is the playback-serialization the Python speech-controller does
// (an utterance only plays after the prior one ends), fixing the "上一条没说完就
//急着说下一条" overlap. Pure (no Web Audio) so it unit-tests; clear() cancels the
// pending tail (barge-in). Synthesis can still run concurrently — only the tasks
// handed to run() are serialized.

export class SerialQueue {
  private tail: Promise<void> = Promise.resolve();
  private gen = 0;

  // Run `task` after every previously-enqueued task settles. Returns a promise
  // that resolves when THIS task finishes (or is skipped by a clear()).
  run(task: () => Promise<void>): Promise<void> {
    const gen = this.gen;
    const prev = this.tail;
    const p = (async () => {
      await prev.catch(() => undefined);
      if (gen !== this.gen) return; // cancelled by a clear() while we waited
      await task();
    })();
    this.tail = p.catch(() => undefined);
    return p;
  }

  // Drop everything still queued (and skip any waiting-but-not-started task).
  clear(): void {
    this.gen += 1;
    this.tail = Promise.resolve();
  }
}
