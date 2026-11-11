export const production = import.meta.glob('../resources/ko/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export const local = import.meta.env.DEV
  ? (import.meta.glob('../generated-local/ko/*.json', {
      eager: true,
      import: 'default',
    }) as Record<string, unknown>)
  : {};
