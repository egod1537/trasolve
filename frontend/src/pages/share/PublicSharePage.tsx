import { useEffect, useRef, useState } from 'react';
import {
  ANALYTICS_SCREENS,
  type SharedTrip,
  type Trip,
} from '@trasolve/shared';
import {
  buildMapWorkspaceTripPath,
  TripSession,
} from '@/features/map-workspace';
import { useCurrentUser } from '@/features/auth';
import {
  copySharedTrip,
  getSharedTrip,
  TripSharingApiError,
} from '@/shared/api/tripSharing';
import { NL, useL } from '@/shared/i18n';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import { trackEvent } from '@/shared/analytics';
import '@/pages/share/public-share.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; sharedTrip: SharedTrip }
  | { status: 'error' };

type CopyState = { status: 'idle' | 'copying' | 'error' };

export default function PublicSharePage() {
  const L = useL();
  const { state: authState, login, authNotice } = useCurrentUser();
  const token = getToken(window.location.pathname);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    token ? { status: 'loading' } : { status: 'error' },
  );
  const [copyState, setCopyState] = useState<CopyState>({ status: 'idle' });
  const copyRequestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      return () => controller.abort();
    }
    void getSharedTrip(token, controller.signal)
      .then((sharedTrip) => {
        trackSharedTripViewOnce(sharedTrip);
        setLoadState({ status: 'ready', sharedTrip });
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoadState({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, [token]);

  useEffect(
    () => () => {
      copyRequestRef.current?.abort();
      copyRequestRef.current = null;
    },
    [],
  );

  if (loadState.status === 'loading') {
    return (
      <main className="public-share-state" role="status">
        <LoadingSpinner size="md" />
        <p>{L('trip:publicSharePage.status.loading')}</p>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="public-share-state">
        <a className="public-share-state-brand" href="/">
          {NL('Trasolve')}
        </a>
        <EmptyState
          title={L('trip:publicSharePage.title.unavailable')}
          description={L('trip:publicSharePage.description.unavailable')}
        />
      </main>
    );
  }

  const { trip, owner } = loadState.sharedTrip;
  const readonlyTrip: Trip = { ...trip, userId: 'public-share' };
  const copyNotice =
    copyState.status === 'error'
      ? L('trip:publicSharePage.error.copyFailed')
      : authNotice;
  const handleCopy = (): void => {
    if (
      !token ||
      authState.status === 'loading' ||
      copyRequestRef.current !== null
    ) {
      return;
    }
    const returnTo = window.location.pathname + window.location.search;
    if (authState.status === 'signed-out') {
      setCopyState({ status: 'idle' });
      void login(returnTo);
      return;
    }
    const controller = new AbortController();
    copyRequestRef.current = controller;
    setCopyState({ status: 'copying' });
    void copySharedTrip(token, controller.signal)
      .then(({ tripId }) => {
        if (!controller.signal.aborted) {
          window.location.assign(buildMapWorkspaceTripPath(tripId));
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        if (cause instanceof TripSharingApiError && cause.status === 401) {
          setCopyState({ status: 'idle' });
          void login(returnTo);
          return;
        }
        setCopyState({ status: 'error' });
      })
      .finally(() => {
        if (copyRequestRef.current === controller) {
          copyRequestRef.current = null;
        }
      });
  };
  return (
    <main className="public-share-page">
      <TripSession key={trip.id} mode="readonly" trip={readonlyTrip} />
      <header className="public-share-header">
        <a className="public-share-brand" href="/">
          {NL('Trasolve')}
        </a>
        <span className="public-share-title">{trip.title}</span>
        <span className="public-share-owner">
          {owner.avatarUrl && <img src={owner.avatarUrl} alt="" />}
          <span>{owner.displayName}</span>
        </span>
        <Button
          className="public-share-copy-button"
          variant="primary"
          size="sm"
          loading={copyState.status === 'copying'}
          disabled={authState.status === 'loading'}
          onClick={handleCopy}
        >
          {copyState.status === 'copying'
            ? L('trip:publicSharePage.status.copying')
            : authState.status === 'signed-in'
              ? L('trip:publicSharePage.action.copyToMyMap')
              : L('trip:publicSharePage.action.signInToCopy')}
        </Button>
      </header>
      {copyNotice ? (
        <div className="public-share-notice" role="alert">
          {copyNotice}
        </div>
      ) : null}
    </main>
  );
}

const trackedShareViews = new Set<string>();

function trackSharedTripViewOnce(sharedTrip: SharedTrip): void {
  const { shareId, viewerType } = sharedTrip.attribution;
  if (trackedShareViews.has(shareId)) {
    return;
  }
  trackedShareViews.add(shareId);
  trackEvent({
    eventType: 'shared_trip_view',
    screen: ANALYTICS_SCREENS.sharedTripViewer,
    metadata: { shareId, viewerType },
  });
}

function getToken(pathname: string): string | null {
  const match = /^\/share\/([^/]+)\/?$/.exec(pathname);
  if (!match) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}
