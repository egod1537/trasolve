export const DAY_COLOR_PALETTE = [
  '#2563eb',
  '#0e7490',
  '#16a34a',
  '#ca8a04',
  '#ea580c',
  '#dc2626',
  '#db2777',
  '#7c3aed',
  '#475569',
  '#0f172a',
] as const;

export function pickRandomDayColor(
  existingColors: readonly (string | null | undefined)[],
): string {
  const usedColors = new Set(
    existingColors
      .map(normalizeColor)
      .filter((color): color is string => color !== null),
  );
  const unusedColors = DAY_COLOR_PALETTE.filter(
    (color) => !usedColors.has(normalizeColor(color)!),
  );
  const candidates =
    unusedColors.length > 0 ? unusedColors : DAY_COLOR_PALETTE;
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}

function normalizeColor(color: string | null | undefined): string | null {
  const normalized = color?.trim().toLowerCase();
  return normalized ? normalized : null;
}
