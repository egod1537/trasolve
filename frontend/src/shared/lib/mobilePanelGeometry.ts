/** Shared bottom-sheet geometry for map and layer detail cards. */
export function mobilePanelGeometry(bounds: { width: number; height: number }) {
  const gap = 12;
  const height = Math.max(
    0,
    Math.min(bounds.height * 0.62, bounds.height - 100),
  );
  return {
    left: gap,
    top: Math.max(gap, bounds.height - height - gap),
    width: Math.max(0, bounds.width - gap * 2),
    height,
    maxHeight: height,
  };
}
