// Shell command classifier (Initiative 8, v0.15.2) — the deny-regex + interactive
// block that hard-refuses dangerous shell BEFORE it ever reaches a spawner. Port
// of Python exec_command.py:49-106, 240-252.
//
// This file is itself an EVALUATOR-FIREWALL entry (workspace.ts → evaluatorFiles):
// Luna may READ it but never WRITE it — she must not be able to edit the regex
// that gates her own shell.
//
// OWNER DECISION (shell safety = Claude "auto mode"): the deny-regex is a best-
// effort hard block over the known destructive forms below — no flag, no approval,
// no override. It is regex over command TEXT, so it cannot see through arbitrary
// runtime expansion (fetch-to-file-then-run, full shell metaprogramming); it
// covers the common destructive shapes, not every conceivable one. For every OTHER
// command, the v0.15.2 surface is deny-regex + the proactive surface-gate only; the
// per-session WS approval prompt (OWNER DECISION #2 / plan Open Q #2) is deferred to
// a later hardening pass — explicitly NOT built here.

// Dangerous patterns matched against the LOWERCASED command text. A hit is a hard
// refusal naming the matched pattern (recoverable: the model can choose a safer
// command). Ordered roughly by severity; `name` is the human-facing label.
export type DenyRule = { name: string; re: RegExp };

export const DENY_RULES: DenyRule[] = [
  { name: 'rm -rf / recursive-force delete', re: /\brm\s+-[a-z]*[rf][a-z]*\b/ },
  { name: 'find -delete / -exec rm (recursive delete)', re: /\bfind\b.*(?:-delete\b|-exec\s+rm\b)/ },
  { name: 'del /f|/q force delete', re: /\bdel\s+\/[fq]\b/ },
  { name: 'rmdir /s recursive delete', re: /\brmdir\s+\/s\b/ },
  { name: 'shutdown/reboot/poweroff/halt', re: /\b(?:shutdown|reboot|poweroff|halt)\b/ },
  { name: 'disk format/partition (mkfs/diskutil/format/fsck)', re: /\b(?:mkfs|diskutil|diskpart|format|fsck)\b/ },
  { name: 'dd if= (raw disk write)', re: /\bdd\s+if=/ },
  { name: 'sudo / privilege escalation', re: /\bsudo\b/ },
  { name: 'su root', re: /\bsu\s+(?:-\s+)?root\b/ },
  { name: 'nohup (detached process)', re: /(?:^|[^\w])nohup(?:$|[^\w])/ },
  { name: 'disown (detached process)', re: /(?:^|[^\w])disown(?:$|[^\w])/ },
  { name: 'setsid (detached session)', re: /(?:^|[^\w])setsid(?:$|[^\w])/ },
  { name: 'fork bomb', re: /:\s*\(\s*\)\s*\{.*\}\s*;?\s*:/ },
  // remote-code-execution: a download piped into a shell/interpreter. `.*` (not
  // [^|]*) so an intermediate pipe (curl … | tee x | sh) still matches; interpreter
  // alternation covers sh/bash/zsh/dash + python/perl/ruby/node/php. (Cannot catch
  // fetch-to-file-then-run — a fundamental limit of static regex gating.)
  { name: 'curl/wget piped to a shell', re: /\b(?:curl|wget)\b.*\|\s*(?:sudo\s+)?(?:sh|bash|zsh|dash|python3?|perl|ruby|node|php)\b/ },
  // writes into credential / key material (defense-in-depth atop the path block):
  { name: 'write into ~/.ssh', re: /(?:>|>>|\btee\b)[^\n]*(?:~\/\.ssh|\/\.ssh\/)/ },
  { name: 'write into a dotfile rc', re: /(?:>|>>|\btee\b)[^\n]*\/\.(?:bashrc|zshrc|profile|bash_profile|zprofile)\b/ },
  { name: 'security/keychain credential dump', re: /\bsecurity\s+(?:dump-keychain|find-(?:generic|internet)-password)\b/ },
];

// Interactive / TTY-bound commands: refused because the spawner has no TTY, so
// they would hang. Matched on the FIRST token of the command.
export const INTERACTIVE_COMMANDS = new Set<string>([
  'vim',
  'vi',
  'nano',
  'emacs',
  'less',
  'more',
  'top',
  'htop',
  'watch',
  'ssh',
  'scp',
  'sftp',
  'telnet',
  'ftp',
  'tmux',
  'screen',
]);

export type ShellClassification =
  | { allowed: true }
  | { allowed: false; reason: string };

// Extract the first bare command token (skips leading env-assignments like
// `FOO=bar cmd`). Lowercased input expected for the interactive-set compare.
function firstCommandToken(lowered: string): string {
  const tokens = lowered.trim().split(/\s+/).filter((t) => t.length > 0);
  for (const t of tokens) {
    // env-var assignment prefix (NAME=value) — skip to the real command
    if (/^[a-z_][a-z0-9_]*=/.test(t)) continue;
    return t;
  }
  return '';
}

// Classify a raw command. A deny-regex hit OR an interactive first-token returns
// allowed:false with a named reason. Everything else is allowed:true — the
// proactive surface-gate and (future) approval prompt are the next layers, not
// this one.
export function classifyShellCommand(command: string): ShellClassification {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return { allowed: false, reason: 'empty command' };
  }
  const lowered = trimmed.toLowerCase();
  // Collapse empty-quote splices (r""m / r''m → rm) so quote-splitting can't hide a
  // denied token from the regex. ($IFS word-splitting is inert under zsh — the spawn
  // shell — so it needs no normalization; bash would, but the spawner is zsh.)
  const normalized = lowered.replace(/(['"])\1/g, '');

  for (const rule of DENY_RULES) {
    if (rule.re.test(normalized)) {
      return { allowed: false, reason: `blocked dangerous pattern: ${rule.name}` };
    }
  }

  const first = firstCommandToken(normalized);
  if (INTERACTIVE_COMMANDS.has(first)) {
    return {
      allowed: false,
      reason: `interactive command "${first}" is blocked (no TTY in a non-interactive shell)`,
    };
  }

  return { allowed: true };
}
