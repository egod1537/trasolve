import {
  workspaceCommandDefinitions,
  validateWorkspaceCommand,
  type WorkspaceCommandRequest,
} from '@trasolve/shared';

type Token = { value: string; quoted: boolean; start: number };
export function commandTokens(input: string, partial = false): Token[] {
  const tokens: Token[] = [];
  let value = '',
    quote = '',
    escaping = false,
    started = false,
    quoted = false,
    start = 0;
  for (let offset = 0; offset < input.length; offset++) {
    const c = input[offset]!;
    if (!started && !/\s/u.test(c)) {
      start = offset;
    }
    if (escaping) {
      value += c;
      escaping = false;
      continue;
    }
    if (c === '\\') {
      escaping = true;
      started = true;
      continue;
    }
    if (quote) {
      if (c === quote) {
        quote = '';
      } else {
        value += c;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
      quoted = true;
      continue;
    }
    if (/\s/u.test(c)) {
      if (started) {
        tokens.push({ value, quoted, start });
        value = '';
        started = false;
        quoted = false;
      }
      continue;
    }
    value += c;
    started = true;
  }
  if (!partial && (quote || escaping)) {
    throw new Error('INCOMPLETE_QUOTE');
  }
  if (started) {
    tokens.push({ value, quoted, start });
  }
  return tokens;
}
export function parseWorkspaceCommand(input: string): WorkspaceCommandRequest {
  const tokens = commandTokens(input);
  const definition = [...workspaceCommandDefinitions]
    .sort((a, b) => b.name.length - a.name.length)
    .find((d) =>
      d.name
        .split(' ')
        .every(
          (part, index) =>
            !tokens[index]?.quoted && tokens[index]?.value === part,
        ),
    );
  if (!definition) {
    throw new Error('UNKNOWN_COMMAND');
  }
  const rest = tokens.slice(definition.name.split(' ').length);
  const args: Record<string, string | number> = {};
  const positionals: string[] = [];
  let options = true;
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i]!;
    if (options && !token.quoted && token.value === '--') {
      options = false;
      continue;
    }
    if (options && !token.quoted && token.value.startsWith('--')) {
      const [key, inline] = token.value.slice(2).split(/=(.*)/s);
      if (
        !key ||
        !Object.hasOwn(definition.fields, key) ||
        Object.hasOwn(args, key)
      ) {
        throw new Error('INVALID_OPTION');
      }
      const next =
        inline === undefined ? rest[++i] : { value: inline, quoted: true };
      if (!next || (!next.quoted && next.value.startsWith('--'))) {
        throw new Error('MISSING_OPTION_VALUE');
      }
      args[key] = next.value;
    } else {
      positionals.push(token.value);
    }
  }
  let fields = [...definition.positional];
  // Optional selected-place shorthand leaves the required trailing fields intact.
  if (
    ['place time', 'place memo'].includes(definition.name) &&
    positionals.length === fields.length - 1
  ) {
    fields = fields.slice(1);
  }
  if (positionals.length > fields.length) {
    throw new Error('TOO_MANY_ARGUMENTS');
  }
  positionals.forEach((value, index) => {
    const key = fields[index]!;
    if (Object.hasOwn(args, key)) {
      throw new Error('DUPLICATE_ARGUMENT');
    }
    args[key] = value;
  });
  return validateWorkspaceCommand({ name: definition.name, args });
}
