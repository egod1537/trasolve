import type { TripPolylineMode } from '@trasolve/shared';

type Props = {
  mode: TripPolylineMode;
};

export function PolylineModeIcon({ mode }: Props) {
  return (
    <svg
      className={`polyline-mode-icon is-${mode}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {mode === 'straight' && (
        <>
          <circle cx="5" cy="17" r="2.25" />
          <circle cx="19" cy="7" r="2.25" />
          <path d="m7 15.5 10-7" />
        </>
      )}
      {mode === 'walking' && (
        <>
          <circle cx="13" cy="4.5" r="2" />
          <path d="m11.5 8-2.2 4.2 3.2 2.1 1.6 5.2M11.1 9.1l4 2.5 2.6-.6M10.1 13.1l-3.8 5" />
        </>
      )}
      {mode === 'transit' && (
        <>
          <rect x="5.5" y="3.5" width="13" height="15" rx="3" />
          <path d="M7 13.5h10M8 7h8M8.5 21l2-2.5M15.5 18.5l2 2.5" />
          <circle cx="9" cy="16" r="1" />
          <circle cx="15" cy="16" r="1" />
        </>
      )}
      {mode === 'driving' && (
        <>
          <path d="m4 10 1.7-4h12.6l1.7 4 1 1.5V18h-3v-2H6v2H3v-6.5L4 10Z" />
          <path d="M5 10h14" />
          <circle cx="7" cy="13" r="1" />
          <circle cx="17" cy="13" r="1" />
        </>
      )}
    </svg>
  );
}
