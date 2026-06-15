// Symbol extraction (Initiative 8, v0.15.3). Two backends behind one shape:
//   - tree-sitter (structural, `verified:true`): defs are real declarations,
//     refs are real identifier uses — a same-name token inside a comment or
//     string is NOT a node of type `identifier`, so it is excluded (the thing
//     ripgrep-only gets wrong).
//   - regex fallback (`verified:false`): when no grammar is available. Cheaper,
//     line-based, and explicitly marked unverified so the caller/UI can say so.
//
// Output is structured (name+kind+line+signature), never prose, so v0.15.4's
// self-edit proposal can point at exactly what it wants to change.

import type { Node, Parser as ParserType } from 'web-tree-sitter';
import { loadParserFor } from './treeSitter';

export type SymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'enum'
  | 'method'
  | 'variable';

export type SymbolDef = {
  name: string;
  kind: SymbolKind;
  line: number; // 1-indexed
  signature: string;
  exported: boolean;
};

export type SymbolRef = {
  name: string;
  line: number; // 1-indexed
};

export type FileSymbols = {
  defs: SymbolDef[];
  refs: SymbolRef[];
  verified: boolean; // true iff a tree-sitter grammar produced these
};

// tree-sitter node types that introduce a named definition, mapped to our kind.
const DEF_NODE_KINDS: Record<string, SymbolKind> = {
  function_declaration: 'function',
  generator_function_declaration: 'function',
  class_declaration: 'class',
  interface_declaration: 'interface',
  type_alias_declaration: 'type',
  enum_declaration: 'enum',
  method_definition: 'method',
};

function firstLineOf(text: string): string {
  const nl = text.indexOf('\n');
  const line = (nl === -1 ? text : text.slice(0, nl)).trim();
  return line.length > 200 ? line.slice(0, 200) + ' …' : line;
}

// Is this node (or an ancestor up to the program root through export wrappers)
// under an `export` statement? We check the immediate parent chain for an
// export_statement, which is how TS/JS wrap exported declarations.
function isExported(node: Node): boolean {
  let p: Node | null = node.parent;
  // export_statement → declaration, or export_statement → (default) declaration
  while (p) {
    if (p.type === 'export_statement') return true;
    // stop climbing once we leave the immediate declaration wrapper region
    if (p.type === 'program' || p.type === 'statement_block') break;
    p = p.parent;
  }
  return false;
}

function nameOf(node: Node): string | null {
  const named = node.childForFieldName('name');
  if (named) return named.text;
  return null;
}

// Variable declarators that bind a function/arrow expression are surfaced as
// definitions too (const foo = () => ...), matching how repo maps treat them.
function collectVariableDefs(root: Node, out: SymbolDef[]): void {
  for (const decl of root.descendantsOfType('variable_declarator')) {
    const nameNode = decl.childForFieldName('name');
    if (!nameNode || nameNode.type !== 'identifier') continue;
    const value = decl.childForFieldName('value');
    if (!value) continue;
    if (value.type === 'arrow_function' || value.type === 'function_expression') {
      out.push({
        name: nameNode.text,
        kind: 'function',
        line: decl.startPosition.row + 1,
        signature: firstLineOf(decl.text),
        exported: isExported(decl),
      });
    }
  }
}

function extractWithTree(root: Node): { defs: SymbolDef[]; refs: SymbolRef[] } {
  const defs: SymbolDef[] = [];
  for (const [nodeType, kind] of Object.entries(DEF_NODE_KINDS)) {
    for (const node of root.descendantsOfType(nodeType)) {
      const name = nameOf(node);
      if (!name) continue;
      defs.push({
        name,
        kind,
        line: node.startPosition.row + 1,
        signature: firstLineOf(node.text),
        exported: isExported(node),
      });
    }
  }
  collectVariableDefs(root, defs);

  // References: every `identifier` / `type_identifier` node. By construction a
  // comment body or a string literal is NOT an identifier node, so the comment/
  // string false positive ripgrep produces is excluded here.
  const refs: SymbolRef[] = [];
  for (const node of root.descendantsOfType(['identifier', 'type_identifier'])) {
    refs.push({ name: node.text, line: node.startPosition.row + 1 });
  }

  return { defs, refs };
}

let injectedTreeFailure = false;
// Test seam: force the tree-sitter path to be treated as unavailable so the
// regex fallback can be exercised even when a grammar IS present on disk.
export function forceRegexFallbackForTests(on: boolean): void {
  injectedTreeFailure = on;
}

export async function extractSymbols(path: string, source: string): Promise<FileSymbols> {
  if (!injectedTreeFailure) {
    const loaded = await loadParserFor(path);
    if (loaded) {
      const ts = parseWithLoaded(loaded.parser, source);
      if (ts) return { ...ts, verified: true };
    }
  }
  const fallback = extractWithRegex(source);
  return { ...fallback, verified: false };
}

function parseWithLoaded(
  parser: ParserType,
  source: string,
): { defs: SymbolDef[]; refs: SymbolRef[] } | null {
  let tree;
  try {
    tree = parser.parse(source);
  } catch {
    return null;
  }
  if (!tree) return null;
  try {
    return extractWithTree(tree.rootNode);
  } finally {
    tree.delete();
  }
}

// --- regex fallback (unverified) ---------------------------------------------
// Line-oriented. Strips line + block comments first so a name in a comment is
// not counted as a def (a cheap approximation of the tree-sitter exclusion; it
// is still marked verified:false so the caller never over-trusts it).
const DEF_PATTERNS: Array<{ re: RegExp; kind: SymbolKind }> = [
  { re: /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/, kind: 'function' },
  { re: /\b(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, kind: 'class' },
  { re: /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, kind: 'interface' },
  { re: /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/, kind: 'type' },
  { re: /\b(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/, kind: 'enum' },
  { re: /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, kind: 'function' },
];

function stripComments(line: string): string {
  // crude: drop everything after `//` and any `/* ... */` on the line
  let out = line.replace(/\/\*.*?\*\//g, '');
  const lineComment = out.indexOf('//');
  if (lineComment !== -1) out = out.slice(0, lineComment);
  return out;
}

export function extractWithRegex(source: string): { defs: SymbolDef[]; refs: SymbolRef[] } {
  const lines = source.split('\n');
  const defs: SymbolDef[] = [];
  const refs: SymbolRef[] = [];
  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    // track multi-line block comments so a name inside one is not a def
    let code = raw;
    if (inBlockComment) {
      const end = code.indexOf('*/');
      if (end === -1) continue;
      code = code.slice(end + 2);
      inBlockComment = false;
    }
    const open = code.lastIndexOf('/*');
    const close = code.lastIndexOf('*/');
    if (open !== -1 && open > close) inBlockComment = true;
    code = stripComments(code);

    for (const { re, kind } of DEF_PATTERNS) {
      const m = re.exec(code);
      if (m && m[1]) {
        defs.push({
          name: m[1],
          kind,
          line: i + 1,
          signature: code.trim().slice(0, 200),
          exported: /\bexport\b/.test(code),
        });
      }
    }

    // references: identifier-shaped tokens on the (comment-stripped) code line
    const idRe = /[A-Za-z_$][\w$]*/g;
    let tok: RegExpExecArray | null;
    while ((tok = idRe.exec(code)) !== null) {
      refs.push({ name: tok[0], line: i + 1 });
    }
  }

  return { defs, refs };
}
