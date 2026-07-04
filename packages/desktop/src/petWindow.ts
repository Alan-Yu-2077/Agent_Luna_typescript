// v0.28.2 (Initiative 20): pet-window options. Still transparent/frameless/always-on-top, but now
// RESIZABLE with a min size — the whole pet scales by resizing the window (the model re-fits, since
// pixiLive2DSink.fit() re-runs on 'resize'). maximizable:false — a maximized transparent pet is
// nonsense. Pure so it's testable without launching Electron.
export type PetWindowOptions = {
  transparent: boolean;
  frame: boolean;
  hasShadow: boolean;
  alwaysOnTop: boolean;
  resizable: boolean;
  maximizable: boolean;
  minWidth: number;
  minHeight: number;
};

export function petWindowOptions(): PetWindowOptions {
  return {
    transparent: true,
    frame: false,
    hasShadow: false,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    minWidth: 320,
    minHeight: 300, // landscape pet (default 640×480) — allow shrinking below the old portrait 480 floor
  };
}
