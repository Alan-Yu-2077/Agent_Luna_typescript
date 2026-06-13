import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolName, type ServerEvent, type ToolCall, type FinishReason } from '@luna/protocol';
import type { Provider, ProviderToolUse, ProviderUsage } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import { dispatchToolCalls } from '../tools/dispatcher';
import { runGraph, type Graph, type TransitionHook, type TurnNode, type NodeName } from './graph';
import type { Session } from './session';
import { trace, flushTrace, traceEnabled } from '../trace/instrument';
import { appendL2, persistSession } from '../memory/sessionStore';
import { buildActiveContext, maybeFold } from '../memory/l1Window';
import { renderCoreBlock } from '../memory/renderCoreBlock';
import { renderRecallBlock, retrieve } from '../memory/recall/recall';
import { getMemoryDb } from '../memory/sessionStore';
import { loadPersona } from '../persona/loader';
import { renderHumanityBlock } from '../persona/humanity';
import { WAKE_SCENE_BLOCK } from '../persona/scene';

export const MAX_TOOL_ITERATIONS = 8;

const BASE_DIRECTIVES = 'You are Luna. Use the available tools when they help you answer.';

const EMBODIMENT_BLOCK =
  'Runtime embodiment: right now the user reaches you through a plain text chat page — no ' +
  'visible body, no voice yet. A Live2D on-screen form and voiced speech are planned for you ' +
  'later, but they are not active today. Do not claim to be visible, audible, or able to ' +
  'gesture; what you actually have is text, your tools, and your memory.';

// The stable system prefix: base directives + persona reference + embodiment +
// humanity rules + core memory block, marked with a cache_control breakpoint.
// Byte-identical across turns unless the persona file or memory actually
// changed — the prompt-cache invariant. Per-query content never goes here.
export function buildSystemPrompt(_session: Session): Anthropic.TextBlockParam[] {
  const parts: string[] = [BASE_DIRECTIVES];
  if (Bun.env['LUNA_PERSONA'] !== '0') {
    const persona = loadPersona();
    parts.push(
      'The following is the active runtime persona reference for Luna. Follow it consistently, ' +
        'but keep the reply natural and alive instead of sounding scripted or theatrical.\n\n' +
        persona.text,
    );
    parts.push(EMBODIMENT_BLOCK);
    parts.push(renderHumanityBlock());
  }
  if (Bun.env['LUNA_MEMORY_INJECT'] !== '0') {
    const core = renderCoreBlock();
    if (core.length > 0) parts.push(core);
  }
  return [{ type: 'text', text: parts.join('\n\n'), cache_control: { type: 'ephemeral' } }];
}

export type TurnState = {
  session: Session;
  turnId: string;
  userText: string;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  anthropicTools: Anthropic.Tool[];
  text: string;
  thinking: string;
  iteration: number;
  pendingToolUses: ProviderToolUse[];
  stopReason: string;
  finishReason: FinishReason;
  usage: ProviderUsage;
  toolResultBlocks: Anthropic.ToolResultBlockParam[];
  tokenCount: number;
  firstTokenMs: number | null;
  startedMs: number;
};

export function toolsToAnthropicFormat(registry: ToolRegistry): Anthropic.Tool[] {
  return Object.values(registry).map((tool) => {
    const raw = zodToJsonSchema(tool.input, { $refStrategy: 'none' });
    const { $schema: _discard, ...schema } = raw as Record<string, unknown>;
    return {
      name: tool.name,
      description: tool.description,
      input_schema: { ...schema, type: 'object' as const },
    };
  });
}

const graph: Graph<TurnState, TurnNode> = {
  async parse_input(s) {
    const blocks: Anthropic.TextBlockParam[] = [];
    // Wake scene rides the first user turn after boot — message level, never
    // system, so the cached system core stays byte-stable across the boot
    // transition. Persisted as-sent into history like every other block.
    if (Bun.env['LUNA_PERSONA'] !== '0' && s.session.wakePending) {
      blocks.push({ type: 'text', text: WAKE_SCENE_BLOCK });
      s.session.wakePending = false;
    }
    if (Bun.env['LUNA_MEMORY_INJECT'] !== '0' && getMemoryDb()) {
      const hits = await retrieve(s.session.id, s.userText);
      const recall = renderRecallBlock(hits);
      if (recall) blocks.push({ type: 'text', text: recall });
    }
    blocks.push({ type: 'text', text: s.userText });
    s.session.history.push({ role: 'user', content: blocks });
    s.emit({ type: 'turn.started', turn_id: s.turnId });
    return 'build_request';
  },

  async build_request(s) {
    if (s.anthropicTools.length === 0) {
      s.anthropicTools = toolsToAnthropicFormat(s.registry);
    }
    return 'open_stream';
  },

  async open_stream(s) {
    s.pendingToolUses = [];
    for await (const ev of s.provider.chatStream({
      system: buildSystemPrompt(s.session),
      messages: buildActiveContext(s.session),
      tools: s.anthropicTools,
    })) {
      switch (ev.kind) {
        case 'text_delta':
          if (s.firstTokenMs === null) s.firstTokenMs = Date.now() - s.startedMs;
          s.tokenCount += 1;
          s.text += ev.text;
          s.emit({ type: 'reply.token', turn_id: s.turnId, text: ev.text });
          break;
        case 'thinking_delta':
          s.thinking += ev.text;
          break;
        case 'tool_use_start':
          break;
        case 'message_stop':
          s.stopReason = ev.stopReason;
          s.pendingToolUses = ev.toolUses;
          s.usage.input_tokens += ev.usage.input_tokens;
          s.usage.output_tokens += ev.usage.output_tokens;
          s.session.history.push({ role: 'assistant', content: ev.assistantContent });
          break;
      }
    }

    if (s.stopReason === 'tool_use' && s.pendingToolUses.length > 0) {
      return 'dispatch_tools';
    }
    if (s.stopReason === 'max_tokens') {
      s.finishReason = 'max_tokens';
    } else if (s.stopReason === 'refusal') {
      s.finishReason = 'refusal';
    } else {
      s.finishReason = 'end_turn';
    }
    return 'finalize';
  },

  async dispatch_tools(s) {
    const calls: ToolCall[] = [];
    s.toolResultBlocks = [];

    for (const use of s.pendingToolUses) {
      const nameParse = ToolName.safeParse(use.name);
      if (!nameParse.success) {
        const result = {
          kind: 'err' as const,
          code: 'tool_not_found' as const,
          message: `tool not found: ${use.name}`,
          recoverable: false,
        };
        s.emit({ type: 'tool.finished', call_id: use.id, result });
        s.toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: use.id,
          content: JSON.stringify(result),
          is_error: true,
        });
        continue;
      }
      calls.push({ call_id: use.id, tool_name: nameParse.data, input: use.input });
    }

    if (calls.length > 0) {
      for await (const evt of dispatchToolCalls(
        calls,
        { sessionId: s.session.id, sessionMutex: s.session.mutex },
        s.registry,
      )) {
        if (traceEnabled()) {
          trace({
            schema_v: 1,
            kind: 'tool',
            trace_id: s.turnId,
            turn_id: s.turnId,
            session_id: s.session.id,
            t_ms: Date.now(),
            call_id: evt.call_id,
            tool_name: evt.tool_name,
            phase: evt.kind === 'started' ? 'started' : evt.kind === 'progress' ? 'progress' : 'final',
            payload: evt.kind === 'final' ? evt.result : evt.kind === 'progress' ? evt.payload : evt.input,
          });
        }
        switch (evt.kind) {
          case 'started':
            s.emit({
              type: 'tool.started',
              call_id: evt.call_id,
              tool_name: ToolName.parse(evt.tool_name),
              input: evt.input,
            });
            break;
          case 'progress':
            s.emit({ type: 'tool.progress', call_id: evt.call_id, payload: evt.payload });
            break;
          case 'final':
            s.emit({ type: 'tool.finished', call_id: evt.call_id, result: evt.result });
            s.toolResultBlocks.push({
              type: 'tool_result',
              tool_use_id: evt.call_id,
              content: JSON.stringify(evt.result),
              is_error: evt.result.kind === 'err',
            });
            break;
        }
      }
    }
    return 'append_results';
  },

  async append_results(s) {
    const ordered = s.pendingToolUses
      .map((use) => s.toolResultBlocks.find((b) => b.tool_use_id === use.id))
      .filter((b): b is Anthropic.ToolResultBlockParam => b !== undefined);
    s.session.history.push({ role: 'user', content: ordered });
    s.iteration += 1;
    if (s.iteration >= MAX_TOOL_ITERATIONS) {
      s.finishReason = 'max_iterations';
      return 'finalize';
    }
    return 'build_request';
  },

  async finalize(s) {
    s.emit({
      type: 'turn.result',
      turn_id: s.turnId,
      text: s.text,
      finish_reason: s.finishReason,
      usage: s.usage,
    });
    return 'end';
  },
};

export type RunTurnOptions = {
  session: Session;
  turnId: string;
  userText: string;
  provider: Provider;
  registry: ToolRegistry;
  emit: (e: ServerEvent) => void;
  onTransition?: TransitionHook<TurnState, TurnNode>;
};

export async function runTurn(opts: RunTurnOptions): Promise<TurnState> {
  const tracedEmit = (e: ServerEvent) => {
    if (traceEnabled()) {
      trace({
        schema_v: 1,
        kind: 'outbound',
        trace_id: opts.turnId,
        turn_id: opts.turnId,
        session_id: opts.session.id,
        t_ms: Date.now(),
        server_event_type: e.type,
      });
    }
    opts.emit(e);
  };

  const state: TurnState = {
    session: opts.session,
    turnId: opts.turnId,
    userText: opts.userText,
    provider: opts.provider,
    registry: opts.registry,
    emit: tracedEmit,
    anthropicTools: [],
    text: '',
    thinking: '',
    iteration: 0,
    pendingToolUses: [],
    stopReason: '',
    finishReason: 'end_turn',
    usage: { input_tokens: 0, output_tokens: 0 },
    toolResultBlocks: [],
    tokenCount: 0,
    firstTokenMs: null,
    startedMs: Date.now(),
  };

  const onTransition: TransitionHook<TurnState, TurnNode> = (from, to, s) => {
    if (traceEnabled()) {
      trace({
        schema_v: 1,
        kind: 'node',
        trace_id: s.turnId,
        turn_id: s.turnId,
        session_id: s.session.id,
        t_ms: Date.now(),
        node_from: from,
        node_to: to,
        payload:
          from === 'open_stream'
            ? {
                token_count: s.tokenCount,
                first_token_ms: s.firstTokenMs,
                thinking_summary: s.thinking,
              }
            : undefined,
      });
    }
    opts.onTransition?.(from, to, s);
  };

  opts.session.activeTurn = opts.turnId;
  const historyStart = opts.session.history.length;
  try {
    await runGraph(graph, 'parse_input', state, onTransition);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state.finishReason = 'error';
    state.emit({ type: 'error', code: 'turn_failure', message });
  } finally {
    opts.session.activeTurn = null;
    opts.session.turnSeq += 1;
    appendL2({
      sessionId: opts.session.id,
      turnId: opts.turnId,
      userText: opts.userText,
      assistantText: state.text,
      rawContent: opts.session.history.slice(historyStart),
    });
    persistSession(opts.session.id, opts.session.history, opts.session.turnSeq);
    flushTrace(opts.turnId);
    void maybeFold(opts.session, opts.provider).catch(() => {
      /* fold is best-effort; a failed fold leaves verbatim history intact */
    });
  }
  return state;
}

export type { NodeName };
