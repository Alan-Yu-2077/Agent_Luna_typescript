import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import type { ProviderEvent } from '../provider/types';
import { MockProvider } from '../provider/mock';
import { getSession, resetSessions } from './session';
import { buildSystemPrompt, runTurn } from './runTurn';
import { buildWeatherBlock, weatherAmbientEnabled } from './weatherContext';
import { resetWeatherSnapshotForTests, setSnapshotForTests } from '../tools/web/weather/snapshot';
import { setWeatherFetcher, type WeatherSnapshot } from '../tools/web/weather/openMeteo';

const ENV = ['LUNA_WEATHER_AMBIENT', 'LUNA_PERSONA', 'LUNA_MEMORY_INJECT', 'LUNA_LAT_LON'];
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV) saved[k] = Bun.env[k];
  resetSessions();
  resetWeatherSnapshotForTests();
});
afterEach(() => {
  for (const k of ENV) {
    if (saved[k] === undefined) delete Bun.env[k];
    else Bun.env[k] = saved[k];
  }
  resetWeatherSnapshotForTests();
  setWeatherFetcher(null);
});

function snap(over: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    label: 'Shanghai',
    temp: 18,
    feelsLike: 17,
    condition: 'overcast',
    code: 3,
    isDay: true,
    precipMm: 0,
    windKmh: 9,
    high: 21,
    low: 14,
    precipChance: 40,
    sunrise: 'x',
    sunset: 'y',
    units: 'celsius',
    observedMs: Date.now(),
    ...over,
  };
}

function stopEnd(text: string): ProviderEvent {
  const assistantContent = [{ type: 'text', text }] as unknown as Anthropic.ContentBlock[];
  return {
    kind: 'message_stop',
    stopReason: 'end_turn',
    toolUses: [],
    assistantContent,
    usage: { input_tokens: 20, output_tokens: 5 },
  };
}

async function userTextsOf(): Promise<string[]> {
  const provider = new MockProvider([[{ kind: 'text_delta', text: 'hi' }, stopEnd('hi')]]);
  const session = getSession('test');
  await runTurn({ session, turnId: 't1', userText: 'hello', provider, registry: {}, emit: () => {} });
  const content = provider.requests[0]?.messages.find((m) => m.role === 'user')?.content;
  if (!Array.isArray(content)) return [];
  return content
    .filter((b): b is Anthropic.TextBlockParam => b.type === 'text')
    .map((b) => b.text);
}

describe('buildWeatherBlock', () => {
  test('formats a labeled fact (rain, daytime, feels-different)', () => {
    const s = buildWeatherBlock(snap());
    expect(s).toContain('Shanghai');
    expect(s).toContain('overcast');
    expect(s).toContain('18°C');
    expect(s).toContain('feels 17°C');
    expect(s).toContain("today's high 21°C / low 14°C");
    expect(s).toContain('40% chance of rain');
    expect(s).toContain('daytime');
  });

  test('night, no rain, fahrenheit, feels==temp omits the redundant clauses', () => {
    const s = buildWeatherBlock(
      snap({ isDay: false, precipChance: 0, units: 'fahrenheit', feelsLike: 18, temp: 18 }),
    );
    expect(s).toContain('°F');
    expect(s).toContain('night');
    expect(s).not.toContain('feels');
    expect(s).not.toContain('chance of rain');
  });
});

describe('weatherAmbientEnabled', () => {
  test('opt-in: only "1" enables', () => {
    Bun.env['LUNA_WEATHER_AMBIENT'] = '1';
    expect(weatherAmbientEnabled()).toBe(true);
    Bun.env['LUNA_WEATHER_AMBIENT'] = '0';
    expect(weatherAmbientEnabled()).toBe(false);
    delete Bun.env['LUNA_WEATHER_AMBIENT'];
    expect(weatherAmbientEnabled()).toBe(false);
  });
});

describe('cache invariant — weather rides the uncached tail, never the cached block', () => {
  test('buildSystemPrompt is byte-identical across snapshots and leaks no snapshot data', () => {
    Bun.env['LUNA_WEATHER_AMBIENT'] = '1';
    Bun.env['LUNA_PERSONA'] = '0';
    Bun.env['LUNA_MEMORY_INJECT'] = '0';
    const session = getSession('test');
    setSnapshotForTests(snap({ temp: 18, condition: 'overcast' }));
    const a = buildSystemPrompt(session)[0]!.text;
    setSnapshotForTests(snap({ temp: -5, condition: 'heavy snow' }));
    const b = buildSystemPrompt(session)[0]!.text;
    expect(a).toBe(b);
    // the data-free WEATHER_CLAUSE is present, but no snapshot value leaks in
    expect(a).toContain('weather where Alan is');
    expect(a).not.toContain('overcast');
    expect(a).not.toContain('heavy snow');
    expect(a).not.toContain('18°C');
  });
});

describe('ambient injection into the uncached user tail', () => {
  test('flag on + cached snapshot → the weather block rides the user message; no fetch on the reactive path', async () => {
    Bun.env['LUNA_WEATHER_AMBIENT'] = '1';
    setWeatherFetcher(() => {
      throw new Error('the reactive path must not fetch');
    });
    const s = snap();
    setSnapshotForTests(s);
    const texts = await userTextsOf();
    expect(texts).toContain(buildWeatherBlock(s));
  });

  test('flag off → no weather block', async () => {
    Bun.env['LUNA_WEATHER_AMBIENT'] = '0';
    setSnapshotForTests(snap());
    const texts = await userTextsOf();
    expect(texts.some((t) => t.startsWith('Weather where Alan is'))).toBe(false);
  });

  test('flag on but cold cache → omit the block (never fetch, never fail)', async () => {
    Bun.env['LUNA_WEATHER_AMBIENT'] = '1';
    setWeatherFetcher(() => {
      throw new Error('must not fetch');
    });
    resetWeatherSnapshotForTests();
    const texts = await userTextsOf();
    expect(texts.some((t) => t.startsWith('Weather where Alan is'))).toBe(false);
  });
});
