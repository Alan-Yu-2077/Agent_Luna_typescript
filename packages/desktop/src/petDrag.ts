// v0.28.6: manual pet-window drag. `-webkit-app-region: drag` (v0.28.2) swallowed EVERY mousedown
// in the region before the DOM saw it — clicks inside the pet never fired, and no-drag islands are
// unreliable on transparent frameless windows. The desktop-pet-standard fix: the renderer decides
// what a drag is (pointerdown on her body + movement), and the shell just moves the window by the
// reported screen-space delta. Clicks stay ordinary DOM events — nothing intercepts them.
// Pure + dependency-injected so the math is testable without Electron.

export type PetDragDeps = {
  getPosition(): [number, number];
  setPosition(x: number, y: number): void;
};

export type PetDrag = {
  begin(): void;
  move(dx: number, dy: number): void;
  end(): void;
  dragging(): boolean;
};

export function createPetDrag(deps: PetDragDeps): PetDrag {
  let start: [number, number] | null = null;
  return {
    begin() {
      start = deps.getPosition();
    },
    // dx/dy are TOTAL deltas from the drag start (screen coords), not increments — absolute
    // placement from a fixed origin can't accumulate rounding drift across events.
    move(dx: number, dy: number) {
      if (!start || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      deps.setPosition(Math.round(start[0] + dx), Math.round(start[1] + dy));
    },
    end() {
      start = null;
    },
    dragging: () => start !== null,
  };
}
