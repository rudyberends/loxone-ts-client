/** Pure helpers shared by the `loxone` CLI and its tests (no side effects). */

/** Room capabilities usable as bare commands inside a `use <room>` context. */
export const SHELL_CAPABILITIES = ['temperature', 'humidity', 'presence', 'brightness', 'lighting', 'audio'] as const;

const COMMANDS = ['rooms', 'items', 'get', 'set', 'room', 'watch', 'use', 'help', 'exit'] as const;

/** Splits a line into tokens, honouring single/double quotes. */
export function tokenize(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote = '';
  for (const ch of line) {
    if (quote) {
      if (ch === quote) quote = '';
      else current += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) {
        out.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) out.push(current);
  return out;
}

export interface CompleteContext {
  rooms: string[];
  items: string[];
  types: string[];
  /** True when a `use <room>` context is active (capabilities become top-level commands). */
  inRoom: boolean;
}

/**
 * Tab-completion for the interactive shell. Returns `[hits, partial]` in the shape
 * Node's `readline` completer expects. Multi-word names are returned quoted so the
 * line re-tokenises correctly.
 */
export function completeLine(line: string, ctx: CompleteContext): [string[], string] {
  const tokens = tokenize(line);
  const trailingSpace = /\s$/.test(line);
  const argIndex = trailingSpace ? tokens.length : Math.max(0, tokens.length - 1);
  const partial = trailingSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const command = tokens[0] ?? '';
  const prev = argIndex > 0 ? tokens[argIndex - 1] : undefined;

  let candidates: string[];
  if (argIndex === 0) {
    candidates = [...COMMANDS, ...(ctx.inRoom ? SHELL_CAPABILITIES : [])];
  } else if (prev === '--room' || command === 'use' || (command === 'room' && argIndex === 1)) {
    candidates = ctx.rooms;
  } else if (prev === '--type') {
    candidates = ctx.types;
  } else if (command === 'room' && argIndex === 2) {
    candidates = [...SHELL_CAPABILITIES];
  } else if ((command === 'get' || command === 'set') && argIndex === 1) {
    candidates = ctx.items;
  } else if (command === 'items') {
    candidates = ['--room', '--type'];
  } else {
    candidates = [];
  }

  const lower = partial.toLowerCase();
  const hits = candidates.filter((c) => c.toLowerCase().startsWith(lower)).map((h) => (/\s/.test(h) ? `"${h}"` : h));
  return [hits, partial];
}
