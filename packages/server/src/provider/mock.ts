import type { Provider, ProviderEvent, ProviderRequest } from './types';

export class MockProvider implements Provider {
  private rounds: ProviderEvent[][];
  private callIndex = 0;
  requests: ProviderRequest[] = [];

  constructor(rounds: ProviderEvent[][]) {
    this.rounds = rounds;
  }

  async *chatStream(req: ProviderRequest): AsyncIterable<ProviderEvent> {
    this.requests.push({ ...req, messages: [...req.messages] });
    const round = this.rounds[this.callIndex];
    this.callIndex += 1;
    if (!round) {
      throw new Error(`MockProvider: no scripted round at index ${this.callIndex - 1}`);
    }
    for (const event of round) {
      await Bun.sleep(1);
      if (event.kind === 'thinking_delta' && event.text === '__THROW__') {
        throw new Error('mock provider mid-stream failure');
      }
      yield event;
    }
  }
}
