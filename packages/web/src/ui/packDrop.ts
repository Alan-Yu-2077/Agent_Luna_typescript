// v0.37.3 (Initiative 27): drop a voice pack onto the RUNNING app — scan → one-tap confirm chip →
// install → the managed voice hot-swaps. Changing her voice must not require re-entering setup.
// Desktop-only (needs the lunaSetup scan/install bridges); ambiguous packs (multiple candidate
// weights) are routed to the wizard where the full picker lives.

export type PackScan = { gpt: string[]; sovits: string[]; refWavs: string[]; transcripts: string[] };
export type PackPicks = { gptCkpt: string; sovitsPth: string; referenceWav: string; transcriptTxt?: string };

// Single-candidate packs auto-pick (the bilibili pack shape); anything ambiguous → null (use the wizard).
export function autoPicksFrom(scan: PackScan): PackPicks | null {
  if (scan.gpt.length !== 1 || scan.sovits.length !== 1 || scan.refWavs.length !== 1) return null;
  return {
    gptCkpt: scan.gpt[0]!,
    sovitsPth: scan.sovits[0]!,
    referenceWav: scan.refWavs[0]!,
    ...(scan.transcripts.length > 0 ? { transcriptTxt: scan.transcripts[0]! } : {}),
  };
}

export function swapResultText(r: Record<string, unknown>): string {
  if (r['ok'] !== true) return typeof r['error'] === 'string' ? r['error'] : 'Voice install failed';
  if (r['managed'] === true && r['ready'] === true) return '✓ 音色已切换 · Voice swapped';
  if (r['managed'] === true) return '已安装 — 语音服务就绪后自动应用 · Installed, applies when the runtime is ready';
  return '已安装 — 请手动重启你的语音服务 · Installed — restart your voice server';
}

export type PackDropBridge = {
  scanVoicePack(file: File): Promise<Record<string, unknown>>;
  installVoicePack(args: Record<string, string>): Promise<Record<string, unknown>>;
};

export function mountPackDrop(doc: Document, bridge: PackDropBridge): () => void {
  let chip: HTMLElement | null = null;
  const dismiss = (): void => {
    chip?.remove();
    chip = null;
  };
  const show = (build: (el: HTMLElement) => void): void => {
    dismiss();
    chip = doc.createElement('div');
    chip.className = 'pack-drop-chip';
    build(chip);
    doc.body.appendChild(chip);
  };
  const flash = (text: string): void => {
    show((el) => {
      el.textContent = text;
    });
    setTimeout(dismiss, 3200);
  };

  const onDragOver = (ev: DragEvent): void => {
    if (ev.dataTransfer?.types.includes('Files')) ev.preventDefault();
  };
  const onDrop = (ev: DragEvent): void => {
    const file = ev.dataTransfer?.files.item(0);
    if (!file) return;
    ev.preventDefault();
    void bridge.scanVoicePack(file).then((r) => {
      if (r['ok'] !== true || typeof r['root'] !== 'string') {
        flash(typeof r['error'] === 'string' ? r['error'] : '不是音色包 · Not a voice pack');
        return;
      }
      const root = r['root'];
      const scan = r['scan'] as PackScan | undefined;
      const picks = scan ? autoPicksFrom(scan) : null;
      if (!picks) {
        flash('候选不止一个——请到设置向导里安装 · Ambiguous pack — install it from the setup wizard');
        return;
      }
      const preview = typeof r['transcriptPreview'] === 'string' ? r['transcriptPreview'] : '';
      show((el) => {
        const label = doc.createElement('span');
        label.textContent = `换成这个音色包?· Swap voice to “${root.split('/').pop() ?? root}”?`;
        const apply = doc.createElement('button');
        apply.type = 'button';
        apply.textContent = '应用 · Apply';
        apply.addEventListener('click', () => {
          apply.disabled = true;
          label.textContent = '安装中… · Installing…';
          void bridge
            .installVoicePack({
              root,
              gptCkpt: picks.gptCkpt,
              sovitsPth: picks.sovitsPth,
              referenceWav: picks.referenceWav,
              ...(picks.transcriptTxt ? { transcriptTxt: picks.transcriptTxt } : {}),
              promptText: preview,
              promptLang: 'en',
              textLang: 'auto',
            })
            .then((res) => flash(swapResultText(res)));
        });
        const cancel = doc.createElement('button');
        cancel.type = 'button';
        cancel.textContent = '取消 · Cancel';
        cancel.addEventListener('click', dismiss);
        el.append(label, apply, cancel);
      });
    });
  };

  doc.addEventListener('dragover', onDragOver);
  doc.addEventListener('drop', onDrop);
  return () => {
    doc.removeEventListener('dragover', onDragOver);
    doc.removeEventListener('drop', onDrop);
    dismiss();
  };
}
