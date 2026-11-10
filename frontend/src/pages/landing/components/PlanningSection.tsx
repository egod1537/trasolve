import { useL } from '@/shared/i18n';

type PreviewKind = 'schedule' | 'route' | 'optimization';

function PlanningPreview({ kind }: { kind: PreviewKind }) {
  return (
    <div className="planning-preview" aria-hidden="true">
      <svg viewBox="0 0 320 200" focusable="false">
        {kind === 'schedule' && (
          <>
            <path className="preview-muted-line" d="M52 40v120" />
            {[0, 1, 2].map((row) => (
              <g key={row} transform={`translate(0 ${row * 52})`}>
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
            ))}
          </>
        )}
        {kind === 'route' && (
          <>
            <path
              className="preview-streets"
              d="M0 50h320M0 100h320M0 150h320M60 0v200M120 0v200M180 0v200M240 0v200M300 0v200"
            />
            <path className="preview-route-soft" d="M60 144 155 60 258 120" />
            <path className="preview-route" d="M60 144 155 60 258 120" />
            {[
              [60, 144],
              [155, 60],
              [258, 120],
            ].map(([x, y], index) => (
              <g key={index} transform={`translate(${x} ${y})`}>
                <circle className="preview-panel" r="14" />
                <circle className="preview-pin" r="6" />
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
              className="preview-route-soft"
              d="M48 148 104 48 260 56 218 151"
            />
            <path className="preview-route" d="M48 148 104 48 260 56 218 151" />
            {[
              [48, 148],
              [104, 48],
              [260, 56],
              [218, 151],
            ].map(([x, y], index) => (
              <g key={index} transform={`translate(${x} ${y})`}>
                <circle className="preview-panel" r="11" />
                <circle className="preview-pin" r="4" />
              </g>
            ))}
          </>
        )}
      </svg>
    </div>
  );
}

export function PlanningSection() {
  const L = useL();
  const features = [
    {
      kind: 'schedule' as const,
      title: L('common:featureSection.features.title.travelItinerary'),
      description: L(
        'common:featureSection.features.description.organizePlacesTimesVisitByDate',
      ),
    },
    {
      kind: 'route' as const,
      title: L('common:featureSection.features.title.movementPath'),
      description: L(
        'common:featureSection.features.description.checkLocationMovementOrderBetweenLocations',
      ),
    },
    {
      kind: 'optimization' as const,
      title: L(
        'routeOptimization:routeOptimizationModal.title.routeOptimization',
      ),
      description: L(
        'routeOptimization:routeOptimizationModal.description.compareCurrentVisitSequenceOptimizedVisit',
      ),
    },
  ];
  return (
    <section className="planning" aria-labelledby="planning-title">
      <div className="planning-inner">
        <h2 id="planning-title">
          {L('common:featureSection.title.manageSchedulesRoutesTogether')}
        </h2>
        <div className="planning-grid">
          {features.map((feature, index) => (
            <article className="planning-feature" key={feature.kind}>
              <PlanningPreview kind={feature.kind} />
              <div className="planning-feature-copy">
                <span className="planning-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
