import type Anthropic from '@anthropic-ai/sdk';

// v0.16.3 — clean durable history. Keep the scratchpad out of stored/sent
// history so a window-turn costs what a *conversational* turn should: strip
// prior-turn thinking (the Anthropic API drops it across turns anyway), and
// collapse older tool-result payloads to a marker (the platform's own
// context-editing pattern — keep the call record, drop the re-fetchable bulk).
// This is what makes Initiative 10's ~100-turn window affordable.

// Default ON; LUNA_CLEAN_HISTORY=0 keeps full thinking + tool payloads in history.
export function cleanHistoryEnabled(): boolean {
  return Bun.env['LUNA_CLEAN_HISTORY'] !== '0';
}

// How many most-recent messages keep their tool-result payloads verbatim (the
// model still sees recent tool output); older ones collapse to a marker.
const KEEP_RECENT_TOOL_MSGS = Number(Bun.env['LUNA_KEEP_RECENT_TOOL_MSGS'] ?? 6);

const THINKING_TYPES = new Set(['thinking', 'redacted_thinking']);

// In-place: drop thinking/redacted_thinking blocks from completed assistant
// messages in [from, end). Applied only AFTER a turn finalizes, so the in-flight
// tool-use loop's signed thinking is never touched (modifying it is a 400). The
// spoken text + tool_use records remain, so context is structurally intact.
export function stripThinking(messages: Anthropic.MessageParam[], from = 0): void {
  for (let i = Math.max(0, from); i < messages.length; i++) {
    const m = messages[i]!;
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    const kept = m.content.filter((b) => !THINKING_TYPES.has((b as { type: string }).type));
    // Never strip a message to empty (would be invalid) — only when something remains.
    if (kept.length > 0 && kept.length !== m.content.length) {
      m.content = kept as typeof m.content;
    }
  }
}

// Non-mutating: return a copy where tool_result payloads in all but the most
// recent `keepRecent` messages are collapsed to a marker. The tool_result block
// (and its tool_use_id) stays, so tool_use↔tool_result pairing is preserved.
export function collapseOldToolResults(
  messages: Anthropic.MessageParam[],
  keepRecent = KEEP_RECENT_TOOL_MSGS,
): Anthropic.MessageParam[] {
  const cutoff = messages.length - Math.max(0, keepRecent);
  if (cutoff <= 0) return messages;
  return messages.map((m, i) => {
    if (i >= cutoff || m.role !== 'user' || !Array.isArray(m.content)) return m;
    let changed = false;
    const content = m.content.map((b) => {
      if ((b as { type: string }).type === 'tool_result') {
        changed = true;
        return { ...(b as object), content: '[tool_result elided]' } as typeof b;
      }
      return b;
    });
    return changed ? ({ ...m, content } as Anthropic.MessageParam) : m;
  });
}
