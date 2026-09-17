export type TimelineParticipant = 'testbed' | 'trasolve' | 'troute';

export interface TimelineEntry {
  id: string;
  pairId: string;
  timestamp: number;
  direction: 'REQUEST' | 'RESPONSE';
  source: TimelineParticipant;
  target: TimelineParticipant;
  method?: string;
  path?: string;
  status?: number;
  latencyMs?: number;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  raw?: string;
  error?: string;
}

export function createTimelineId(): string {
  return crypto.randomUUID();
}

export function sortTimeline(
  timeline: readonly TimelineEntry[],
): readonly TimelineEntry[] {
  const alreadyOrdered = timeline.every(
    (entry, index) =>
      index === 0 || timeline[index - 1]!.timestamp <= entry.timestamp,
  );
  if (alreadyOrdered) {
    return timeline;
  }
  return [...timeline].sort((left, right) => left.timestamp - right.timestamp);
}
