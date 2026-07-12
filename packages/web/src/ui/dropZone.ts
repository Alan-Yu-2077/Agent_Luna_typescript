// v0.35.2 (Initiative 25): a reusable drag-and-drop target for the wizard — the avatar step drops a
// Live2D folder here, the voice step (v0.35.3) reuses it with a different handler. Pure DOM; the
// caller owns validation and status reporting.

export function createDropZone(
  doc: Document,
  opts: { label: string; onFiles: (files: FileList) => void },
): HTMLElement {
  const zone = doc.createElement('div');
  zone.className = 'wizard-drop-zone';
  zone.textContent = opts.label;
  const setOver = (over: boolean): void => {
    zone.classList.toggle('over', over);
  };
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    setOver(true);
  });
  zone.addEventListener('dragleave', () => setOver(false));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) opts.onFiles(e.dataTransfer.files);
  });
  return zone;
}
