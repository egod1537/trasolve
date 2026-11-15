import { useEffect, useRef } from 'react';

export type PreviewKind = 'schedule' | 'route' | 'optimization';

export function PlanningPreview({ kind }: { kind: PreviewKind }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    let visible = false;
    const update = () => {
      element.dataset.playing = String(visible && !document.hidden);
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`planning-preview planning-preview-${kind}`}
      data-playing="false"
      aria-hidden="true"
    >
      <svg viewBox="0 0 320 200" focusable="false">
        {kind === 'schedule' && (
          <>
            <path
              className="preview-muted-line preview-timeline"
              pathLength="1"
              d="M52 40v120"
            />
            {[0, 1, 2].map((row) => (
              <g key={row} transform={`translate(0 ${row * 52})`}>
                <g className={`preview-schedule-row preview-step-${row}`}>
                  <circle className="preview-pin" cx="52" cy="49" r="5" />
                  <rect
                    className="preview-panel"
                    x="76"
                    y="28"
                    width="198"
                    height="42"
                    rx="8"
                  />
                  <rect
                    className="preview-accent-soft"
                    x="88"
                    y="40"
                    width="20"
                    height="18"
                    rx="4"
                  />
                  <path className="preview-ink" d="M122 43h66" />
                  <path className="preview-muted-line" d="M122 55h112" />
                </g>
              </g>
            ))}
          </>
        )}
        {kind === 'route' && (
          <>
            <path
              className="preview-streets"
              d="M0 50h320M0 100h320M0 150h320M60 0v200M120 0v200M180 0v200M240 0v200M300 0v200"
            />
            <path
              pathLength="1"
              className="preview-route-soft"
              d="M60 144 155 60 258 120"
            />
            <path
              pathLength="1"
              className="preview-route"
              d="M60 144 155 60 258 120"
            />
            {[
              [60, 144],
              [155, 60],
              [258, 120],
            ].map(([x, y], index) => (
              <g key={index} transform={`translate(${x} ${y})`}>
                <g className={`preview-node preview-step-${index}`}>
                  <circle className="preview-panel" r="14" />
                  <circle className="preview-pin" r="6" />
                </g>
              </g>
            ))}
          </>
        )}
        {kind === 'optimization' && (
          <>
            <path
              className="preview-old-route"
              d="M48 148 260 56 104 48 218 151"
            />
            <path
              pathLength="1"
              className="preview-route-soft"
              d="M48 148 104 48 260 56 218 151"
            />
            <path
              pathLength="1"
              className="preview-route"
              d="M48 148 104 48 260 56 218 151"
            />
            {[
              [48, 148],
              [104, 48],
              [260, 56],
              [218, 151],
            ].map(([x, y], index) => (
              <g key={index} transform={`translate(${x} ${y})`}>
                <g className={`preview-node preview-step-${index}`}>
                  <circle className="preview-panel" r="11" />
                  <circle className="preview-pin" r="4" />
                </g>
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}
