export type Releaser = () => void;

type QueueEntry = {
  resolve: (release: Releaser) => void;
  reject: (e: Error) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
};

export class Mutex {
  private locked = false;
  private queue: QueueEntry[] = [];

  async acquire(signal?: AbortSignal): Promise<Releaser> {
    if (signal?.aborted) {
      throw new Error('Mutex acquire aborted');
    }
    if (!this.locked) {
      this.locked = true;
      return this.makeReleaser();
    }
    return new Promise<Releaser>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, signal };
      if (signal) {
        entry.onAbort = () => {
          const idx = this.queue.indexOf(entry);
          if (idx >= 0) this.queue.splice(idx, 1);
          reject(new Error('Mutex acquire aborted'));
        };
        signal.addEventListener('abort', entry.onAbort, { once: true });
      }
      this.queue.push(entry);
    });
  }

  private makeReleaser(): Releaser {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.releaseToNext();
    };
  }

  private releaseToNext(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) break;
      if (next.signal && next.onAbort) {
        next.signal.removeEventListener('abort', next.onAbort);
      }
      if (next.signal?.aborted) {
        next.reject(new Error('Mutex acquire aborted'));
        continue;
      }
      next.resolve(this.makeReleaser());
      return;
    }
    this.locked = false;
  }
}
