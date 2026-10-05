import {
  type AnalyticsEventRequestMetadata,
  type AnalyticsEventType,
  type AnalyticsScreen,
  type AnalyticsTarget,
} from '@trasolve/shared';
import {
  sendAnalyticsEvent,
  type AnalyticsEventRequest,
} from '@/shared/api/analytics';
import { getAnalyticsSessionId } from '@/shared/analytics/session';
import { getLanguage } from '@/shared/i18n';

export type TrackEventInput = {
  eventType: AnalyticsEventType;
  screen: AnalyticsScreen;
  target?: AnalyticsTarget | null;
  metadata?: AnalyticsEventRequestMetadata | null;
};

/**
 * Queues an analytics event without exposing transport or identity details to UI
 * callers. Delivery failures are intentionally ignored and never reject a user
 * action. The backend derives userId from the authenticated request.
 */
export function trackEvent(input: TrackEventInput): void {
  try {
    const request: AnalyticsEventRequest = {
      sessionId: getAnalyticsSessionId(),
      eventType: input.eventType,
      screen: input.screen,
      target: input.target ?? null,
      timestamp: new Date().toISOString(),
      metadata: {
        ...input.metadata,
        locale: getLanguage(),
      },
    };
    void sendAnalyticsEvent(request).catch(() => undefined);
  } catch {
    return;
  }
}

export function screenView(screen: AnalyticsScreen): void {
  trackEvent({ eventType: 'screen_view', screen });
}
