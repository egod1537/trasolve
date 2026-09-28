import { useEffect, useState } from 'react';
import type { SharedTrip, Trip } from '@trasolve/shared';
import { TripSession } from '@/features/map-workspace';
import { getSharedTrip } from '@/shared/api/tripSharing';
import { NL, useL } from '@/shared/i18n';
import { EmptyState } from '@/shared/ui/EmptyState';
import { LoadingSpinner } from '@/shared/ui/LoadingSpinner';
import '@/pages/share/public-share.css';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; sharedTrip: SharedTrip }
  | { status: 'error' };

export default function PublicSharePage() {
  const L = useL();
  const token = getToken(window.location.pathname);
  const [state, setState] = useState<LoadState>(() =>
    token ? { status: 'loading' } : { status: 'error' },
  );

  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      return () => controller.abort();
    }
    void getSharedTrip(token, controller.signal)
      .then((sharedTrip) => setState({ status: 'ready', sharedTrip }))
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ status: 'error' });
        }
      });
    return () => controller.abort();
  }, [token]);

  if (state.status === 'loading') {
    return (
      <main className="public-share-state" role="status">
        <LoadingSpinner size="md" />
        <p>{L('trip:publicSharePage.status.loading')}</p>
      </main>
    );
  }

  if (state.status === 'error') {
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

  const { trip, owner } = state.sharedTrip;
  const readonlyTrip: Trip = { ...trip, userId: 'public-share' };
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
      </header>
    </main>
  );
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
