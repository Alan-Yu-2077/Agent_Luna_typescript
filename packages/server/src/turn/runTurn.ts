import type Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { ToolName, type ServerEvent, type ToolCall, type FinishReason } from '@luna/protocol';
import type { Provider, ProviderToolUse, ProviderUsage } from '../provider/types';
import type { ToolRegistry } from '../tools/registry';
import { dispatchToolCalls } from '../tools/dispatcher';
import { runGraph, type Graph, type TransitionHook, type NodeName } from './graph';
import type { Session } from './session';

export const MAX_TOOL_ITERATIONS = 8;

const SYSTEM_PROMPT_PLACEHOLDER =
  'You are Luna, a helpful assistant. Use the available tools when they help you answer. Reply concisely.';

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

const graph: Graph<TurnState> = {
  async parse_input(s) {
    s.session.history.push({ role: 'user', content: s.userText });
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
      system: SYSTEM_PROMPT_PLACEHOLDER,
      messages: s.session.history,
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
  onTransition?: TransitionHook<TurnState>;
};

export async function runTurn(opts: RunTurnOptions): Promise<TurnState> {
  const state: TurnState = {
    session: opts.session,
    turnId: opts.turnId,
    userText: opts.userText,
    provider: opts.provider,
    registry: opts.registry,
    emit: opts.emit,
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

  opts.session.activeTurn = opts.turnId;
  try {
    await runGraph(graph, 'parse_input', state, opts.onTransition);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    state.finishReason = 'error';
    state.emit({ type: 'error', code: 'turn_failure', message });
  } finally {
    opts.session.activeTurn = null;
    opts.session.turnSeq += 1;
  }
  return state;
}

export type { NodeName };
