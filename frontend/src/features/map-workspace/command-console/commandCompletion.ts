import { workspaceCommandDefinitions, type Trip } from '@trasolve/shared';
import { commandTokens } from './parseCommand';
export type CommandCompletion = {
  label: string;
  detail: string;
  value: string;
};
export function completeCommand(
  input: string,
  trip: Trip,
): CommandCompletion[] {
  const trim = input.trimStart();
  const names = workspaceCommandDefinitions
    .filter((d) => !trim || d.name.startsWith(trim))
    .map((d) => ({ label: d.name, detail: d.syntax, value: `${d.name} ` }));
  if (names.length) {
    return names.slice(0, 12);
  }
  const tokens = commandTokens(input, true);
  const endSpace = /\s$/.test(input);
  const last = endSpace ? '' : (tokens.at(-1)?.value ?? '');
  const definition = [...workspaceCommandDefinitions]
    .sort((a, b) => b.name.length - a.name.length)
    .find((d) => trim.startsWith(`${d.name} `));
  if (!definition) {
    return [];
  }
  const base = endSpace
    ? input
    : input.slice(0, tokens.at(-1)?.start ?? input.length);
  const argumentsBefore = tokens.slice(
    definition.name.split(' ').length,
    endSpace ? undefined : -1,
  );
  const previous = argumentsBefore.at(-1);
  let field: string | undefined;
  if (
    previous &&
    !previous.quoted &&
    previous.value.startsWith('--') &&
    !previous.value.includes('=')
  ) {
    field = previous.value.slice(2);
  } else {
    let count = 0;
    for (let i = 0; i < argumentsBefore.length; i++) {
      const token = argumentsBefore[i]!;
      if (!token.quoted && token.value.startsWith('--')) {
        if (!token.value.includes('=')) {
          i++;
        }
      } else {
        count++;
      }
    }
    field = definition.positional[count];
  }
  let values: string[] = [];
  if (last.startsWith('--')) {
    values = Object.keys(definition.fields).map((key) => `--${key}`);
  } else if (field === 'day') {
    values = trip.days.map((_d, i) => String(i + 1));
    if (['day show', 'day hide'].includes(definition.name)) {
      values.push('all');
    }
  } else if (field === 'mode') {
    values = ['straight', 'walking', 'transit', 'driving'].filter(
      (value) => value !== 'straight' || definition.name === 'route mode',
    );
  } else if (field === 'tool') {
    values = ['pan', 'distance', 'area'];
  } else if (field === 'format') {
    values = ['pdf', 'kml', 'kmz'];
  } else if (['place', 'from', 'to', 'near'].includes(field ?? '')) {
    values = trip.days.flatMap((d) => d.places.map((p) => p.name));
  } else if (field === 'color') {
    values = [
      'blue',
      'red',
      'green',
      'orange',
      'purple',
      'pink',
      'teal',
      'yellow',
    ];
  }
  return [...new Set(values)]
    .filter((v) =>
      v
        .toLocaleLowerCase()
        .startsWith(last.replace(/^['"]/, '').toLocaleLowerCase()),
    )
    .slice(0, 12)
    .map((value) => ({
      label: value,
      detail: definition.syntax,
      value: `${base}${/\s|["\\]/.test(value) ? JSON.stringify(value) : value} `,
    }));
}
