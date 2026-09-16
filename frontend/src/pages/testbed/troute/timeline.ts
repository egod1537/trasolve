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
): TimelineEntry[] {
  return [...timeline].sort((left, right) => left.timestamp - right.timestamp);
}
