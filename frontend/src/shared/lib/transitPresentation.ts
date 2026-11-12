import type { MapRoute } from '@trasolve/shared';

type Step = MapRoute['legs'][number]['steps'][number];
type Details = NonNullable<Step['transitDetails']>;

// Bus service categories stay fixed across alternatives and ride order.
const BUS_COLORS: Record<NonNullable<Details['busType']>, string> = {
  trunk: '#386de8',
  branch: '#3cab34',
  local: '#3cab34',
  rapid: '#f04040',
  circulation: '#f6b600',
  airport: '#8b62d9',
};
const NEUTRAL_COLOR = '#788493';

export function getTransitStyle(step: Step) {
  const details = step.transitDetails;
  const walking = step.travelMode === 'WALK' || step.travelMode === 'WALKING';
  const categoryColor = details?.busType ? BUS_COLORS[details.busType] : null;
  const lineColor = validColor(details?.lineColor);
  const color = walking
    ? NEUTRAL_COLOR
    : (categoryColor ?? lineColor ?? NEUTRAL_COLOR);
  return {
    color,
    // Use provider text color only together with that provider's background.
    textColor:
      !walking && !categoryColor && lineColor
        ? (validColor(details?.lineTextColor) ?? contrastText(color))
        : contrastText(color),
  };
}

function validColor(value: string | null | undefined): string | null {
  return value && /^#[\da-f]{6}$/i.test(value) ? value : null;
}

function contrastText(color: string): string {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#17212b' : '#ffffff';
}
