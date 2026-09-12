export function formatDurationMinutes(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) {
    return `${minutes}분`;
  }
  return minutes ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}
