type Settled<T> =
  | { sourceIndex: number; kind: 'value'; result: IteratorResult<T> }
  | { sourceIndex: number; kind: 'error'; error: unknown };

function tag<T>(p: Promise<IteratorResult<T>>, sourceIndex: number): Promise<Settled<T>> {
  return p.then(
    (result) => ({ sourceIndex, kind: 'value' as const, result }),
    (error) => ({ sourceIndex, kind: 'error' as const, error }),
  );
}

export async function* mergeAsync<T>(
  sources: AsyncIterable<T>[],
  onSourceError?: (sourceIndex: number, error: unknown) => T | undefined,
): AsyncGenerator<T, void, unknown> {
  const iterators = sources.map((s) => s[Symbol.asyncIterator]());
  const pending: Array<Promise<Settled<T>> | null> = iterators.map((it, i) => tag(it.next(), i));

  try {
    while (pending.some((p) => p !== null)) {
      const active = pending.filter((p): p is Promise<Settled<T>> => p !== null);
      const winner = await Promise.race(active);

      if (winner.kind === 'error') {
        pending[winner.sourceIndex] = null;
        const fallback = onSourceError?.(winner.sourceIndex, winner.error);
        if (fallback !== undefined) yield fallback;
        continue;
      }

      if (winner.result.done) {
        pending[winner.sourceIndex] = null;
        continue;
      }

      yield winner.result.value;

      const it = iterators[winner.sourceIndex];
      if (it) {
        pending[winner.sourceIndex] = tag(it.next(), winner.sourceIndex);
      }
    }
  } finally {
    await Promise.allSettled(
      iterators.map((it) => (it.return ? it.return(undefined) : Promise.resolve())),
    );
  }
}
