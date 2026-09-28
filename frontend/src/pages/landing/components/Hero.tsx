import heroMap from '@/shared/assets/hero-map.png';
import { HeroVisual } from '@/pages/landing/components/HeroVisual';
import { useL } from '@/shared/i18n';

type Props = {
  authNotice: string | null;
  primaryActionLabel: string;
  primaryActionDisabled: boolean;
  onPrimaryAction: () => void;
};

export function Hero({
  authNotice,
  primaryActionLabel,
  primaryActionDisabled,
  onPrimaryAction,
}: Props) {
  const L = useL();
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-background" aria-hidden="true">
        <img src={heroMap} alt="" decoding="async" draggable={false} />
        <div className="hero-background-overlay" />
      </div>
      <div className="hero-copy">
        <h1 id="hero-title">
          {L('common:hero.title.travelItineraryRoute')}
          <br />
          {L('common:hero.title.organizeItAllAtOnce')}
        </h1>
        <p className="hero-description">
          {L('common:hero.description.placeScheduleOnePlan')}
          <br className="desktop-break" />
          {L('common:hero.description.makeTravelPlanByLookingAt')}
        </p>
        <div
          className="hero-actions"
          aria-label={L('common:hero.ariaLabel.startMenu')}
        >
          <button
            type="button"
            className="button button-primary"
            disabled={primaryActionDisabled}
            aria-busy={primaryActionDisabled}
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
          </button>
          <a className="button button-secondary" href="#features">
            {L('common:hero.text.viewFeatures')}
          </a>
        </div>
        {authNotice && (
          <p className="hero-auth-notice" role="alert">
            {authNotice}
          </p>
        )}
      </div>
      <HeroVisual />
    </section>
  );
}
