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
  // that resolves when THIS task finishes, or `undefined` if a clear() skipped it.
  // v0.43.14: generic, so a caller can learn what its task returned — `speak` uses it to report
  // whether the utterance actually played, and a skipped task is exactly "it did not".
  run<T>(task: () => Promise<T>): Promise<T | undefined> {
    const gen = this.gen;
    const prev = this.tail;
    const p = (async (): Promise<T | undefined> => {
      await prev.catch(() => undefined);
      if (gen !== this.gen) return undefined; // cancelled by a clear() while we waited
      return task();
    })();
    this.tail = p.then(
      () => undefined,
      () => undefined,
    );
    return p;
  }

  // Drop everything still queued (and skip any waiting-but-not-started task).
  clear(): void {
    this.gen += 1;
    this.tail = Promise.resolve();
  }
}
