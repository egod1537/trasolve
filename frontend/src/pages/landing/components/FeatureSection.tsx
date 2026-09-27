import { FeatureCard } from '@/pages/landing/components/FeatureCard';
import { useL, L } from '@/shared/i18n';

const features = [
  {
    get title() {
      return L('common:featureSection.features.title.travelItinerary');
    },
    get description() {
      return L(
        'common:featureSection.features.description.organizePlacesTimesVisitByDate',
      );
    },
  },
  {
    get title() {
      return L('common:featureSection.features.title.movementPath');
    },
    get description() {
      return L(
        'common:featureSection.features.description.checkLocationMovementOrderBetweenLocations',
      );
    },
  },
  {
    get title() {
      return L('common:featureSection.features.title.travelTemplate');
    },
    get description() {
      return L(
        'common:featureSection.features.description.startPlanningTripByReferringDifferent',
      );
    },
  },
];

export function FeatureSection() {
  const L = useL();
  return (
    <section
      className="features"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="section-heading">
        <h2 id="features-title">
          {L('common:featureSection.title.manageSchedulesRoutesTogether')}
        </h2>
      </div>
      <ol className="feature-list">
        {features.map((feature, index) => (
          <FeatureCard
            key={feature.title}
            {...feature}
            index={String(index + 1).padStart(2, '0')}
          />
        ))}
      </ol>
    </section>
  );
}
