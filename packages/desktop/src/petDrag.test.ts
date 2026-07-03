import { describe, expect, test } from 'bun:test';
import { createPetDrag } from './petDrag';

function harness(startX = 100, startY = 200) {
  const moves: Array<[number, number]> = [];
  const drag = createPetDrag({
    getPosition: () => [startX, startY],
    setPosition: (x, y) => moves.push([x, y]),
  });
  return { drag, moves };
}

describe('createPetDrag (v0.28.6)', () => {
  test('moves are absolute from the drag-start origin — no incremental drift', () => {
    const { drag, moves } = harness(100, 200);
    drag.begin();
    drag.move(10, 5);
    drag.move(30, -20); // TOTAL delta, not an increment
    expect(moves).toEqual([
      [110, 205],
      [130, 180],
    ]);
  });

  test('move before begin / after end is a no-op', () => {
    const { drag, moves } = harness();
    drag.move(50, 50); // never began
    drag.begin();
    drag.end();
    drag.move(50, 50); // ended
    expect(moves).toEqual([]);
    expect(drag.dragging()).toBe(false);
  });

  test('non-finite deltas are ignored; positions round to integers', () => {
    const { drag, moves } = harness(0, 0);
    drag.begin();
    drag.move(Number.NaN, 5);
    drag.move(Number.POSITIVE_INFINITY, 0);
    drag.move(10.6, 4.4);
    expect(moves).toEqual([[11, 4]]);
  });
});
