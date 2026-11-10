import type { TrouteTravelMode } from '@trasolve/shared';

export function TravelModeIcon({ mode }: { mode: TrouteTravelMode }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {mode === 'TRANSIT' ? (
        <>
          <rect x="5" y="3" width="14" height="15" rx="3" />
          <path d="M5 10h14M8 21l2-3m6 3-2-3M9 14h.01M15 14h.01" />
        </>
      ) : mode === 'DRIVING' ? (
        <>
          <path d="m4 10 2-6h12l2 6v9H4v-9ZM4 10h16M7 19v2m10-2v2M7 14h2m6 0h2" />
        </>
      ) : mode === 'WALKING' ? (
        <>
          <circle cx="13" cy="4" r="2" />
          <path d="m9 21 3-8m3 8-3-8 1-6m-7 7 3-5 4-2 3 5 4 1" />
        </>
      ) : (
        <>
          <circle cx="5" cy="17" r="4" />
          <circle cx="19" cy="17" r="4" />
          <path d="m5 17 5-9 5 9H5m5-9h6l3 9M8 5h4m3-2h3l-2 5" />
        </>
      )}
    </svg>
  );
}

export function DepartureIcon({
  policy,
}: {
  policy: 'fixed' | 'earliest' | 'latest';
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {policy === 'fixed' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6v6l4 2" />
        </>
      ) : (
        <>
          <path d="M3 20h18M5 16a7 7 0 0 1 14 0M2 12l2 1m16 0 2-1M6 6l2 2m8 0 2-2" />
          <path
            d={
              policy === 'earliest'
                ? 'M12 12V2m-3 3 3-3 3 3'
                : 'M12 2v10m-3-3 3 3 3-3'
            }
          />
        </>
      )}
    </svg>
  );
}
