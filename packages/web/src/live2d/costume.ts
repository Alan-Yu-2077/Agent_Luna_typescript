import { COSTUME } from './faceData';

// v0.43.10 — what she is wearing, persisted.
//
// The owner's ruling (2026-07-31): props stay walled off from the EMOTION system and open to HIM.
// v0.43.8 made them try-on-able for a session; this makes wearing a decision that survives a restart.
// Three actors, three permissions, and this module is the third one's storage:
//
//   emotion system (OVERLAYS / automatic selection) — never
//   the LLM (the `message` tool)                    — never; the schema has no such field
//   the owner (settings, workbench)                 — freely
//
// One key, read by the settings card, the workbench and the sink, so "what is she wearing" has a
// single answer no matter which surface asked.

export const COSTUME_KEY = 'luna:costume';

export type CostumeState = Record<string, boolean>;

export function parseCostume(raw: string | null): CostumeState {
  if (raw === null || raw === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: CostumeState = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      // Unknown ids are dropped, not carried: the catalog shrinking must not resurrect a param that
      // nothing writes 0 to any more.
      if (id in COSTUME && (v === true || v === 1)) out[id] = true;
    }
    return out;
  } catch {
    return {}; // malformed — she wears nothing rather than crashing the boot
  }
}

export function loadCostume(storage?: Pick<Storage, 'getItem'> | null): CostumeState {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    return parseCostume(s?.getItem(COSTUME_KEY) ?? null);
  } catch {
    return {};
  }
}

export function saveCostume(state: CostumeState, storage?: Pick<Storage, 'setItem'> | null): void {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
    s?.setItem(COSTUME_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable — this session only */
  }
}

// Turning one item on or off, with the mutual-exclusion groups applied. Pure, so the settings card
// and the workbench share one behaviour instead of each reimplementing "the other hairstyle comes
// off when this one goes on".
export function toggleCostume(state: CostumeState, id: string, on: boolean): CostumeState {
  const item = COSTUME[id];
  if (!item) return state;
  const next: CostumeState = { ...state };
  if (!on) {
    delete next[id];
    return next;
  }
  if (item.group !== undefined) {
    for (const [other, def] of Object.entries(COSTUME)) {
      if (other !== id && def.group === item.group) delete next[other];
    }
  }
  next[id] = true;
  return next;
}

// The full write set for a state change: every catalog item gets an explicit value, so an item that
// was just removed is actively released (`null`) rather than left latched on — the same reason
// `ALL_OVERLAY_PARAMS` is written whole each frame.
export function costumeWrites(state: CostumeState): Array<[string, number | null]> {
  return Object.entries(COSTUME).map(([id, def]) => [def.pid, state[id] === true ? 1 : null]);
}
