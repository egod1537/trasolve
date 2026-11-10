import { type ReactNode } from 'react';
import type {
  AnalyticsEventMetadata,
  AnalyticsSessionSummary,
} from '@trasolve/shared';
import type { PaginatedAnalyticsState } from '@/features/analytics-sessions/model/usePaginatedAnalytics';
import { type AnalyticsSessionsExplorerLabels } from '@/features/analytics-sessions/ui/analyticsSessionTypes';

export function MetadataSummary({
  metadata,
  labels,
}: {
  metadata: AnalyticsEventMetadata | null;
  labels: AnalyticsSessionsExplorerLabels;
}) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return <span>{labels.noMetadata}</span>;
  }
  return (
    <div className="analytics-event-metadata">
      <div className="analytics-event-metadata-compact">
        {Object.entries(metadata)
          .slice(0, 4)
          .map(([key, value]) => (
            <span key={key}>
              <strong>{key}</strong>={formatMetadataValue(value)}
            </span>
          ))}
      </div>
      <details>
        <summary>{labels.metadataDetails}</summary>
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      </details>
    </div>
  );
}

export function PaginationControl<Item>({
  state,
  labels,
  onLoadMore,
}: {
  state: Extract<PaginatedAnalyticsState<Item>, { status: 'ready' }>;
  labels: AnalyticsSessionsExplorerLabels;
  onLoadMore: () => void;
}) {
  if (state.nextCursor === null) {
    return null;
  }
  return (
    <div className="analytics-session-pagination">
      {state.loadMoreStatus === 'error' ? (
        <span role="alert">{labels.error}</span>
      ) : null}
      <button
        type="button"
        disabled={state.loadMoreStatus === 'loading'}
        onClick={onLoadMore}
      >
        {state.loadMoreStatus === 'loading'
          ? labels.loadingMore
          : state.loadMoreStatus === 'error'
            ? labels.retry
            : labels.loadMore}
      </button>
    </div>
  );
}

export function ErrorState({
  labels,
  onRetry,
}: {
  labels: AnalyticsSessionsExplorerLabels;
  onRetry: () => void;
}) {
  return (
    <div className="analytics-session-state" role="alert">
      <p>{labels.error}</p>
      <button type="button" onClick={onRetry}>
        {labels.retry}
      </button>
    </div>
  );
}

export function getIdentityLabel(
  session: AnalyticsSessionSummary,
  labels: AnalyticsSessionsExplorerLabels,
): string {
  if (session.userIds.length > 0 && session.hasAnonymousEvents) {
    return labels.mixedIdentity;
  }
  return session.userIds.length > 0 ? labels.authenticated : labels.anonymous;
}

export function shortenSessionId(sessionId: string): string {
  return sessionId.length <= 16
    ? sessionId
    : `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`;
}

export function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(timestamp));
}

export function formatMetadataValue(value: unknown): ReactNode {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean' || value === null) {
    return JSON.stringify(value);
  }
  const serialized = JSON.stringify(value);
  return serialized.length > 80 ? `${serialized.slice(0, 77)}…` : serialized;
}
