const DEFAULT_MARKER_COLOR = '#2563eb';
const ROUTE_SATURATION = 0.8;
const ROUTE_LIGHTNESS = 0.46;
const DARK_FOREGROUND = '#0f172a';

function getColorHue(color: string): number {
  const hex = /^#[\da-f]{6}$/i.test(color) ? color : DEFAULT_MARKER_COLOR;
  const [red, green, blue] = [1, 3, 5].map(
    (offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255,
  );
  const maximum = Math.max(red, green, blue);
  const delta = maximum - Math.min(red, green, blue);
  if (!delta) {
    return 0;
  }
  const sector =
    maximum === red
      ? (green - blue) / delta
      : maximum === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return (sector * 60 + 360) % 360;
}

function relativeLuminance(channels: readonly number[]): number {
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function routeColor(hue: number) {
  const amplitude =
    ROUTE_SATURATION * Math.min(ROUTE_LIGHTNESS, 1 - ROUTE_LIGHTNESS);
  const channels = [0, 8, 4].map((offset) => {
    const sector = (offset + hue / 30) % 12;
    return (
      ROUTE_LIGHTNESS -
      amplitude * Math.max(-1, Math.min(sector - 3, 9 - sector, 1))
    );
  });
  const background = `#${channels
    .map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
  const luminance = relativeLuminance(channels);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast =
    (luminance + 0.05) /
    (relativeLuminance([15 / 255, 23 / 255, 42 / 255]) + 0.05);
  return {
    background,
    foreground: whiteContrast >= darkContrast ? '#ffffff' : DARK_FOREGROUND,
  };
}

export function getMarkerRoutePalette(color: string) {
  const hue = getColorHue(color);
  return {
    start: routeColor((hue + 120) % 360),
    end: routeColor((hue + 240) % 360),
  };
}
