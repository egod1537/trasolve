import { useL } from '@/shared/i18n';
import { PlanningPreview } from './PlanningPreview';

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
