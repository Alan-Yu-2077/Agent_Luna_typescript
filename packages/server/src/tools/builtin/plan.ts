import { z } from 'zod';
import { defineTool } from '../defineTool';
import { getSession, type PlanItem } from '../../turn/session';

// plan (Initiative 8, v0.15.3) — the todo spine for multi-step code work. Mirrors
// Claude Code's TaskCreate/TaskUpdate: a session-scoped, revisable list. State
// lives on the Session object (NOT persisted); each call emits a tool.progress
// event carrying the full plan so the web UI can render it live. safe + session-
// serial (mutates one shared session field, so never concurrent with itself).
const Status = z.enum(['pending', 'in_progress', 'done']);

const ItemInput = z.object({
  id: z.string().optional().describe('stable id for update; omit on set to auto-assign'),
  text: z.string().min(1).describe('the step text'),
  status: Status.optional().describe('defaults to pending on set'),
});

const Input = z.object({
  action: z.enum(['set', 'update', 'get']).describe("'set' replaces the plan; 'update' merges by id; 'get' reads it"),
  items: z.array(ItemInput).optional().describe('the steps (required for set/update; ignored for get)'),
});

const ItemOutput = z.object({
  id: z.string(),
  text: z.string(),
  status: Status,
});

const Output = z.object({
  plan: z.array(ItemOutput),
});

function nextId(existing: PlanItem[], offset: number): string {
  const used = new Set(existing.map((i) => i.id));
  let n = existing.length + offset + 1;
  let id = `s${n}`;
  while (used.has(id)) {
    n += 1;
    id = `s${n}`;
  }
  return id;
}

export const planTool = defineTool({
  name: 'plan',
  description:
    'Maintain a visible todo list for multi-step work. action:"set" replaces the plan with the given ' +
    'items; "update" merges items by id (flip a status, edit text, append new ones); "get" returns the ' +
    'current plan. Set a plan before a multi-step code task and update it as you finish each step.',
  input: Input,
  output: Output,
  concurrency: 'session-serial',
  proactiveRisk: 'safe',
  timeoutMs: 2000,
  summarize: (out) => {
    const done = out.plan.filter((i) => i.status === 'done').length;
    return `plan: ${done}/${out.plan.length} done`;
  },
  execute: async function* (input, ctx) {
    const session = getSession(ctx.sessionId);

    if (input.action === 'set') {
      const items: PlanItem[] = [];
      for (const it of input.items ?? []) {
        items.push({
          id: it.id ?? nextId(items, 0),
          text: it.text,
          status: it.status ?? 'pending',
        });
      }
      session.plan = items;
    } else if (input.action === 'update') {
      const byId = new Map(session.plan.map((i) => [i.id, i]));
      const appended: PlanItem[] = [];
      for (const it of input.items ?? []) {
        if (it.id && byId.has(it.id)) {
          const cur = byId.get(it.id)!;
          cur.text = it.text;
          if (it.status) cur.status = it.status;
        } else {
          const item: PlanItem = {
            id: it.id ?? nextId([...session.plan, ...appended], 0),
            text: it.text,
            status: it.status ?? 'pending',
          };
          appended.push(item);
        }
      }
      session.plan = [...session.plan, ...appended];
    }

    const snapshot = session.plan.map((i) => ({ id: i.id, text: i.text, status: i.status }));
    // surface the plan to the UI before the final result (mirrors message tool's
    // progress contract — the web client subscribes to tool.progress).
    yield { kind: 'progress', payload: { plan: snapshot } };
    yield { kind: 'ok', data: { plan: snapshot } };
  },
});
