import {
  analyticsEventSchema,
  funnelAggregationFiltersSchema,
  tripShareAttributionResultSchema,
  type AnalyticsEvent,
  type FunnelAggregationFilters,
  type ShareViewerType,
  type TripShareAttributionResult,
} from '@trasolve/shared';
import { compareAnalyticsEvents } from '../flowAggregation.js';

type AttributedCopy = {
  readonly shareId: string;
  readonly timestampMs: number;
};

export async function analyzeTripShareAttribution(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  filtersInput: FunnelAggregationFilters = {},
): Promise<TripShareAttributionResult> {
  const filters = funnelAggregationFiltersSchema.parse(filtersInput);
  const eventsBySession = new Map<string, AnalyticsEvent[]>();

  for await (const input of eventInput) {
    const event = analyticsEventSchema.parse(input);
    if (!matchesFilters(event, filters)) {
      continue;
    }
    const sessionEvents = eventsBySession.get(event.sessionId) ?? [];
    sessionEvents.push(event);
    eventsBySession.set(event.sessionId, sessionEvents);
  }

  const enabledSessions = new Set<string>();
  const copiedSessions = new Set<string>();
  const copiesByShareId = new Map<string, AttributedCopy>();
  const eligibleEvents: AnalyticsEvent[] = [];

  for (const [sessionId, events] of eventsBySession) {
    if (!matchesAuthenticationFilter(events, filters.authenticated)) {
      continue;
    }
    events.sort(compareAnalyticsEvents);
    eligibleEvents.push(...events);
    const enabledAtByShareId = new Map<string, number>();

    for (const event of events) {
      const shareId = event.metadata?.shareId;
      if (!shareId) {
        continue;
      }
      const timestampMs = Date.parse(event.timestamp);
      if (event.eventType === 'share_enable') {
        enabledSessions.add(sessionId);
        if (!enabledAtByShareId.has(shareId)) {
          enabledAtByShareId.set(shareId, timestampMs);
        }
        continue;
      }
      if (
        event.eventType !== 'share_link_copy' ||
        (enabledAtByShareId.get(shareId) ?? Number.POSITIVE_INFINITY) >
          timestampMs
      ) {
        continue;
      }
      copiedSessions.add(sessionId);
      const current = copiesByShareId.get(shareId);
      if (!current || timestampMs < current.timestampMs) {
        copiesByShareId.set(shareId, { shareId, timestampMs });
      }
    }
  }

  eligibleEvents.sort(compareAnalyticsEvents);
  const viewedShareIds = new Set<string>();
  const viewerSessions = new Set<string>();
  const viewerSessionsByShare = new Set<string>();
  const ownerSelfViewSessions = new Set<string>();
  const externalViewerSessions = new Set<string>();
  const anonymousViewerSessions = new Set<string>();
  const firstViewAtByShareId = new Map<string, number>();

  for (const event of eligibleEvents) {
    if (event.eventType !== 'shared_trip_view') {
      continue;
    }
    const shareId = event.metadata?.shareId;
    const copy = shareId ? copiesByShareId.get(shareId) : undefined;
    const timestampMs = Date.parse(event.timestamp);
    if (!copy || timestampMs < copy.timestampMs) {
      continue;
    }
    viewedShareIds.add(copy.shareId);
    viewerSessions.add(event.sessionId);
    viewerSessionsByShare.add(`${copy.shareId}\0${event.sessionId}`);
    addViewerSession(
      event.metadata?.viewerType,
      event.sessionId,
      ownerSelfViewSessions,
      externalViewerSessions,
      anonymousViewerSessions,
    );
    const firstViewAt = firstViewAtByShareId.get(copy.shareId);
    if (firstViewAt === undefined || timestampMs < firstViewAt) {
      firstViewAtByShareId.set(copy.shareId, timestampMs);
    }
  }

  const firstViewDurations = Array.from(firstViewAtByShareId, ([shareId, at]) =>
    Math.max(0, at - copiesByShareId.get(shareId)!.timestampMs),
  );
  return tripShareAttributionResultSchema.parse({
    enabledSessions: enabledSessions.size,
    copiedSessions: copiedSessions.size,
    copiedShareIds: copiesByShareId.size,
    viewedShareIds: viewedShareIds.size,
    viewerSessions: viewerSessions.size,
    ownerSelfViewSessions: ownerSelfViewSessions.size,
    externalViewerSessions: externalViewerSessions.size,
    anonymousViewerSessions: anonymousViewerSessions.size,
    enableToCopyConversion: ratio(copiedSessions.size, enabledSessions.size),
    copyToViewConversion: ratio(viewedShareIds.size, copiesByShareId.size),
    averageViewersPerSharedTrip: ratio(
      viewerSessionsByShare.size,
      copiesByShareId.size,
    ),
    averageTimeFromCopyToFirstViewMs:
      firstViewDurations.length === 0 ? null : average(firstViewDurations),
    medianTimeFromCopyToFirstViewMs:
      firstViewDurations.length === 0 ? null : median(firstViewDurations),
  });
}

function matchesFilters(
  event: AnalyticsEvent,
  filters: FunnelAggregationFilters,
): boolean {
  const timestampMs = Date.parse(event.timestamp);
  return (
    (filters.from === undefined || timestampMs >= Date.parse(filters.from)) &&
    (filters.to === undefined || timestampMs <= Date.parse(filters.to)) &&
    (filters.locale === undefined || event.metadata?.locale === filters.locale)
  );
}

function matchesAuthenticationFilter(
  events: readonly AnalyticsEvent[],
  authenticated: boolean | undefined,
): boolean {
  if (authenticated === undefined) {
    return true;
  }
  const hasAuthenticatedEvent = events.some((event) => event.userId !== null);
  return authenticated ? hasAuthenticatedEvent : !hasAuthenticatedEvent;
}

function addViewerSession(
  viewerType: ShareViewerType | undefined,
  sessionId: string,
  ownerSessions: Set<string>,
  externalSessions: Set<string>,
  anonymousSessions: Set<string>,
): void {
  if (viewerType === 'owner_self') {
    ownerSessions.add(sessionId);
  } else if (viewerType === 'anonymous') {
    anonymousSessions.add(sessionId);
    externalSessions.add(sessionId);
  } else {
    externalSessions.add(sessionId);
  }
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
