// What a chat provider can do (Initiative 16, v0.23.0). Each Provider self-declares this so
// callers branch on a capability, never on a model-id regex. The Anthropic path declares
// everything true; the OpenAI-protocol provider (v0.23.1+) declares per-model values driven by
// the registry (v0.23.3).
export type ProviderCapabilities = {
  thinking: boolean; // adaptive/extended thinking or reasoning content
  promptCache: boolean; // honors explicit cache_control breakpoints (else they're stripped)
  interleavedToolStreaming: boolean; // tool-use streams mid-reply (not buffered to the end)
  toolUse: boolean; // function/tool calling
  systemRole: boolean; // a dedicated system message/param (vs folding into the first user turn)
  maxOutputTokens: number;
};

// A compact one-line summary for the startup log.
export function describeCapabilities(c: ProviderCapabilities): string {
  const flags = [
    c.thinking && 'thinking',
    c.promptCache && 'prompt-cache',
    c.interleavedToolStreaming && 'tool-stream',
    c.toolUse && 'tools',
    c.systemRole && 'system-role',
  ].filter((f): f is string => typeof f === 'string');
  return `${flags.join(', ')}; max_out=${c.maxOutputTokens}`;
}
