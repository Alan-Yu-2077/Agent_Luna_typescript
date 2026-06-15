// Lint-on-write (Initiative 8, v0.15.1) — the SWE-agent ACI lever: after a
// successful edit/write to a TS/JS file, run a FAST syntactic parse and fold any
// diagnostics straight into the tool result, so a broken edit is caught at edit
// time, not three turns later.
//
// OWNER DECISION (lower-stakes default): this is a *fast syntactic parse*
// (Bun.Transpiler), NOT full tsc — full type-checking is the heavier `typecheck`
// tool in v0.15.2. v1 SURFACES diagnostics; it does NOT auto-revert (a
// reject-broken-edit hard guard is a v0.15.2 hardening option). Behind
// LUNA_LINT_ON_WRITE (default ON; `=0` is the escape hatch).

import { extname } from 'node:path';

// Files we lint. Other extensions (.json, .md, .py, …) skip the hook entirely.
const LINTABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

export type LintDiagnostic = { line?: number; column?: number; message: string };

export function lintOnWriteEnabled(): boolean {
  return Bun.env['LUNA_LINT_ON_WRITE'] !== '0';
}

export function isLintable(path: string): boolean {
  return LINTABLE.has(extname(path).toLowerCase());
}

// Map a path extension to the Transpiler loader. .tsx/.jsx must parse JSX.
function loaderFor(path: string): 'ts' | 'tsx' | 'js' | 'jsx' {
  const ext = extname(path).toLowerCase();
  if (ext === '.tsx') return 'tsx';
  if (ext === '.jsx') return 'jsx';
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return 'js';
  return 'ts';
}

// Parse `content` for `path`; return [] when clean or when the file is not a
// lintable kind. Never throws — a lint-infra failure must not fail the write
// (the write already happened); it just yields no diagnostics.
export function lintContent(path: string, content: string): LintDiagnostic[] {
  if (!lintOnWriteEnabled()) return [];
  if (!isLintable(path)) return [];

  try {
    const transpiler = new Bun.Transpiler({ loader: loaderFor(path) });
    // transformSync throws a BuildMessage-bearing AggregateError on a syntax
    // error; a clean parse returns the JS and we report nothing.
    transpiler.transformSync(content);
    return [];
  } catch (e) {
    return extractDiagnostics(e);
  }
}

// Bun surfaces a transpile failure two ways: a SINGLE syntax error throws a
// `BuildMessage` (with `.message` + `.position`); MULTIPLE errors throw an
// `AggregateError` whose `.errors[]` are BuildMessages. Normalize both to a flat
// diagnostic list. Defensive: a shape we don't recognize degrades to the error's
// own message rather than throwing inside the hook.
type BuildMessageLike = {
  message?: unknown;
  position?: { line?: unknown; column?: unknown } | null;
};

function oneDiagnostic(be: BuildMessageLike, fallback: string): LintDiagnostic {
  const pos = be.position ?? undefined;
  return {
    line: typeof pos?.line === 'number' ? pos.line : undefined,
    column: typeof pos?.column === 'number' ? pos.column : undefined,
    message: typeof be.message === 'string' ? be.message : fallback,
  };
}

function extractDiagnostics(e: unknown): LintDiagnostic[] {
  const errors = (e as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    return errors.map((be) => oneDiagnostic(be as BuildMessageLike, String(be)));
  }
  // Single BuildMessage (or any thrown Error) — its own message + position.
  const message = e instanceof Error ? e.message : String(e);
  return [oneDiagnostic(e as BuildMessageLike, message)];
}

// One-line summary suffix for a tool result, e.g. " · 2 lint issue(s)".
export function lintSummary(diags: LintDiagnostic[]): string {
  if (diags.length === 0) return '';
  return ` · ${diags.length} lint issue${diags.length === 1 ? '' : 's'}`;
}
