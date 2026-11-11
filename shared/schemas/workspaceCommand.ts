import { z } from 'zod';

type ArgumentType =
  'text' | 'memo' | 'index' | 'zoom' | 'clock' | 'mode' | 'format' | 'tool';
type Field = { type: ArgumentType; optional?: boolean };
export type WorkspaceCommandDefinition = {
  name: string;
  syntax: string;
  effect: 'read' | 'edit' | 'ui';
  positional: readonly string[];
  fields: Readonly<Record<string, Field>>;
};
const text: Field = { type: 'text' };
const optionalText: Field = { type: 'text', optional: true };
const index: Field = { type: 'index' };
const optionalIndex: Field = { type: 'index', optional: true };
const mode: Field = { type: 'mode' };
const day = { day: optionalText };
const place = { place: optionalText };
function command(
  name: string,
  syntax: string,
  effect: WorkspaceCommandDefinition['effect'],
  positional: string[],
  fields: Record<string, Field> = {},
): WorkspaceCommandDefinition {
  return { name, syntax, effect, positional, fields };
}
// Stable technical command grammar, shared by terminal parsing and AI requests.
export const workspaceCommandDefinitions = [
  command('search', 'search "<query>" [--near "<place>"]', 'read', ['query'], {
    query: text,
    near: optionalText,
  }),
  command('find', 'find "<query>"', 'read', ['query'], { query: text }),
  command('ai', 'ai "<prompt>"', 'read', ['prompt'], { prompt: text }),
  command('ai new', 'ai new', 'ui', []),
  command('ai stop', 'ai stop', 'ui', []),
  command('trip list', 'trip list', 'read', []),
  command('trip new', 'trip new "<title>"', 'edit', ['title'], { title: text }),
  command('trip open', 'trip open "<trip>"', 'ui', ['trip'], { trip: text }),
  command('trip rename', 'trip rename "<title>"', 'edit', ['title'], {
    title: text,
  }),
  command('trip delete', 'trip delete', 'ui', []),
  command('day list', 'day list', 'read', []),
  command('day add', 'day add "<title>"', 'edit', ['title'], { title: text }),
  command('day select', 'day select <day>', 'ui', ['day'], { day: text }),
  command(
    'day rename',
    'day rename <day> "<title>"',
    'edit',
    ['day', 'title'],
    { day: text, title: text },
  ),
  command('day move', 'day move <day> <order>', 'edit', ['day', 'order'], {
    day: text,
    order: index,
  }),
  command('day show', 'day show <day|all>', 'edit', ['day'], { day: text }),
  command('day hide', 'day hide <day|all>', 'edit', ['day'], { day: text }),
  command('day color', 'day color <day> <color>', 'edit', ['day', 'color'], {
    day: text,
    color: text,
  }),
  command(
    'place add',
    'place add ["<query>"] [--result <index>] [--day <day>]',
    'edit',
    ['query'],
    {
      query: optionalText,
      result: optionalIndex,
      placeId: optionalText,
      ...day,
    },
  ),
  command('place inspect', 'place inspect <placeId>', 'ui', ['placeId'], {
    placeId: text,
  }),
  command('place select', 'place select "<place>"', 'ui', ['place'], {
    place: text,
  }),
  command(
    'place rename',
    'place rename "<place>" "<title>"',
    'edit',
    ['place', 'title'],
    { place: text, title: text },
  ),
  command(
    'place move',
    'place move ["<place>"] --day <day> [--order <index>]',
    'edit',
    ['place'],
    { ...place, day: text, order: optionalIndex },
  ),
  command(
    'place time',
    'place time ["<place>"] <start> <end>',
    'edit',
    ['place', 'start', 'end'],
    { ...place, start: { type: 'clock' }, end: { type: 'clock' } },
  ),
  command(
    'place memo',
    'place memo ["<place>"] "<memo>"',
    'edit',
    ['place', 'memo'],
    { ...place, memo: { type: 'memo' } },
  ),
  command(
    'place color',
    'place color "<place>" <color>',
    'edit',
    ['place', 'color'],
    { place: text, color: text },
  ),
  command('place remove', 'place remove ["<place>"]', 'edit', ['place'], place),
  command(
    'route search',
    'route search "<from>" "<to>" [--mode transit|walking|driving]',
    'read',
    ['from', 'to'],
    { from: text, to: text, mode: { ...mode, optional: true } },
  ),
  command('route mode', 'route mode <mode> [--day <day>]', 'edit', ['mode'], {
    mode,
    ...day,
  }),
  command(
    'route detail',
    'route detail <index> [--batch <id>]',
    'ui',
    ['index'],
    { index, batch: optionalText },
  ),
  command(
    'optimize',
    'optimize [--day <day>] [--start HH:mm] [--end HH:mm] [--mode transit|walking|driving]',
    'read',
    [],
    {
      ...day,
      start: { type: 'clock', optional: true },
      end: { type: 'clock', optional: true },
      mode: { ...mode, optional: true },
    },
  ),
  command('optimize apply', 'optimize apply', 'edit', []),
  command('map fit', 'map fit [--day <day>]', 'ui', [], day),
  command('map goto', 'map goto "<place>"', 'ui', ['place'], { place: text }),
  command('map zoom', 'map zoom <zoom>', 'ui', ['zoom'], {
    zoom: { type: 'zoom' },
  }),
  command('tool', 'tool pan|distance|area', 'ui', ['tool'], {
    tool: { type: 'tool' },
  }),
  command('capture', 'capture', 'ui', []),
  command('export', 'export pdf|kml|kmz', 'ui', ['format'], {
    format: { type: 'format' },
  }),
  command('import', 'import [--day <day>]', 'ui', [], day),
  command('undo', 'undo', 'edit', []),
  command('redo', 'redo', 'edit', []),
  command('settings', 'settings', 'ui', []),
  command('help', 'help [<command>]', 'read', ['command'], {
    command: optionalText,
  }),
] as const;
export const workspaceCommandRequestSchema = z.strictObject({
  name: z
    .string()
    .refine((name) => workspaceCommandDefinitions.some((d) => d.name === name)),
  args: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
});
export type WorkspaceCommandRequest = z.infer<
  typeof workspaceCommandRequestSchema
>;
function argumentSchema(type: ArgumentType) {
  switch (type) {
    case 'index':
      return z.coerce.number().int().positive();
    case 'zoom':
      return z.coerce.number().min(1).max(22);
    case 'clock':
      return z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    case 'mode':
      return z.enum(['straight', 'walking', 'transit', 'driving']);
    case 'tool':
      return z.enum(['pan', 'distance', 'area']);
    case 'format':
      return z.enum(['pdf', 'kml', 'kmz']);
    case 'memo':
      return z.string().max(4000);
    default:
      return z.coerce.string().trim().min(1).max(4000);
  }
}
export function validateWorkspaceCommand(
  input: unknown,
): WorkspaceCommandRequest {
  const request = workspaceCommandRequestSchema.parse(input);
  const definition = workspaceCommandDefinitions.find(
    (d) => d.name === request.name,
  )!;
  const fields = Object.fromEntries(
    Object.entries(definition.fields).map(([name, field]) => {
      const schema = argumentSchema(field.type);
      return [name, field.optional ? schema.optional() : schema];
    }),
  );
  const args = z.strictObject(fields).parse(request.args);
  return {
    name: request.name,
    args: Object.fromEntries(
      Object.entries(args).filter(([, value]) => value !== undefined),
    ) as WorkspaceCommandRequest['args'],
  };
}
