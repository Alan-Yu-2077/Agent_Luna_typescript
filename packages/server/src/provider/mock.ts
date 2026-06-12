import type {
  CompleteRequest,
  CompleteResult,
  Provider,
  ProviderEvent,
  ProviderRequest,
} from './types';

export class MockProvider implements Provider {
  private rounds: ProviderEvent[][];
  private callIndex = 0;
  requests: ProviderRequest[] = [];
  completeRequests: CompleteRequest[] = [];
  completeResponder: (req: CompleteRequest) => Promise<string> | string = () => '[mock summary]';

  constructor(rounds: ProviderEvent[][]) {
    this.rounds = rounds;
  }

  async complete(req: CompleteRequest): Promise<CompleteResult> {
    this.completeRequests.push({ ...req, messages: [...req.messages] });
    const text = await this.completeResponder(req);
    return { text, usage: { input_tokens: 1, output_tokens: 1 } };
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
