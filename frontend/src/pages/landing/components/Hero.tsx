import heroMap from '@/shared/assets/hero-map.png';
import { HeroVisual } from '@/pages/landing/components/HeroVisual';
import { useL } from '@/shared/i18n';

export function Hero() {
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
          <a className="button button-primary" href="/map">
            {L('common:hero.text.gettingStarted')}
          </a>
          <a className="button button-secondary" href="#features">
            {L('common:hero.text.viewFeatures')}
          </a>
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}
