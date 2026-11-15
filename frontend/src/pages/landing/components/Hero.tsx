import { ANALYTICS_SCREENS, type AnalyticsTarget } from '@trasolve/shared';
import { HeroVisual } from '@/pages/landing/components/HeroVisual';
import { useL } from '@/shared/i18n';

type Props = {
  authNotice: string | null;
  primaryActionLabel: string;
  primaryActionTarget: AnalyticsTarget;
  primaryActionDisabled: boolean;
  onPrimaryAction: () => void;
};

export function Hero({
  authNotice,
  primaryActionLabel,
  primaryActionTarget,
  primaryActionDisabled,
  onPrimaryAction,
}: Props) {
  const L = useL();
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">
          <span className="hero-title-line">
            {L('common:landing.hero.title.places')}
          </span>
          <span className="hero-title-line">
            <span className="hero-title-accent">
              {L('common:landing.hero.title.connected')}
            </span>{' '}
            {L('common:landing.hero.title.journey')}
          </span>
        </h1>
        <p className="hero-description">
          {L('common:landing.hero.description')}
        </p>
        <div
          className="hero-actions"
          aria-label={L('common:hero.ariaLabel.startMenu')}
        >
          <button
            type="button"
            className="button button-primary"
            data-analytics-id={primaryActionTarget}
            data-analytics-screen={ANALYTICS_SCREENS.landing}
            disabled={primaryActionDisabled}
            aria-busy={primaryActionDisabled}
            onClick={onPrimaryAction}
          >
            {primaryActionLabel}
            <svg
              className="button-arrow"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M4 12h15m-6-6 6 6-6 6" />
            </svg>
          </button>
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
