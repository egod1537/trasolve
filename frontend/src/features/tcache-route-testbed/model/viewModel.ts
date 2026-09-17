export function getTcacheRouteLocationRole(
  index: number,
  total: number,
): '출발지' | '경유지' | '도착지' {
  if (index === 0) {
    return '출발지';
  }
  if (index === total - 1) {
    return '도착지';
  }
  return '경유지';
}
