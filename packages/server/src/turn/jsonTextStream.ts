// Incremental extractor for the top-level "text" string field of a tool_use
// input streamed as raw partial-JSON chunks (input_json_delta). Chunks split
// arbitrarily — mid-key, mid-string, mid-escape (spike-verified shapes like
// ["", "{\"text\": \"小猫", "第一次", ..., "\"", ", \"is_final", "\": false}"]).
// Only a depth-1 "text" key counts; nested objects (e.g. voice_params) are
// skipped wholesale.

type State =
  | 'pre' // structural scan, outside any string
  | 'key' // inside a depth-1 string that may be an object key
  | 'after_key' // key string closed; deciding whether it introduces a value
  | 'pre_value' // saw "text": — waiting for the value's opening quote
  | 'value' // inside the text value — emit unescaped chars
  | 'other_string' // inside any string we don't care about
  | 'done';

const ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

export class JsonTextStream {
  private state: State = 'pre';
  private depth = 0;
  private keyBuf = '';
  private escaped = false;
  private unicodeHex: string | null = null;

  /** Feed one raw chunk; returns the newly extracted (unescaped) text. */
  push(chunk: string): string {
    let out = '';
    for (const ch of chunk) {
      switch (this.state) {
        case 'pre':
          if (ch === '{' || ch === '[') this.depth += 1;
          else if (ch === '}' || ch === ']') this.depth -= 1;
          else if (ch === '"') {
            this.escaped = false;
            if (this.depth === 1) {
              this.state = 'key';
              this.keyBuf = '';
            } else {
              this.state = 'other_string';
            }
          }
          break;

        case 'key':
          if (this.escaped) {
            this.keyBuf += ch;
            this.escaped = false;
          } else if (ch === '\\') this.escaped = true;
          else if (ch === '"') this.state = 'after_key';
          else this.keyBuf += ch;
          break;

        case 'after_key':
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
          if (ch === ':' && this.keyBuf === 'text') this.state = 'pre_value';
          else if (ch === ':') this.state = 'pre';
          else {
            // the string wasn't a key after all (array element / malformed) —
            // fall back to structural scanning
            this.state = 'pre';
            if (ch === '{' || ch === '[') this.depth += 1;
            else if (ch === '}' || ch === ']') this.depth -= 1;
          }
          break;

        case 'pre_value':
          if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') break;
          if (ch === '"') {
            this.state = 'value';
            this.escaped = false;
            this.unicodeHex = null;
          } else {
            // text value isn't a string (schema forbids this) — bail to scan
            this.state = 'pre';
            if (ch === '{' || ch === '[') this.depth += 1;
            else if (ch === '}' || ch === ']') this.depth -= 1;
          }
          break;

        case 'value':
          if (this.unicodeHex !== null) {
            this.unicodeHex += ch;
            if (this.unicodeHex.length === 4) {
              out += String.fromCharCode(parseInt(this.unicodeHex, 16));
              this.unicodeHex = null;
            }
          } else if (this.escaped) {
            this.escaped = false;
            if (ch === 'u') this.unicodeHex = '';
            else out += ESCAPES[ch] ?? ch;
          } else if (ch === '\\') this.escaped = true;
          else if (ch === '"') this.state = 'done';
          else out += ch;
          break;

        case 'other_string':
          if (this.escaped) this.escaped = false;
          else if (ch === '\\') this.escaped = true;
          else if (ch === '"') this.state = 'pre';
          break;

        case 'done':
          break;
      }
    }
    return out;
  }
}
