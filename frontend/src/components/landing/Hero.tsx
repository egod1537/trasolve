import heroMap from '../../assets/hero-map.png';
import { HeroVisual } from './HeroVisual';

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-background" aria-hidden="true">
        <img src={heroMap} alt="" decoding="async" draggable={false} />
        <div className="hero-background-overlay" />
      </div>
      <div className="hero-copy">
        <h1 id="hero-title">
          여행 일정과 경로를
          <br />한 번에 정리하세요.
        </h1>
        <p className="hero-description">
          장소와 일정을 하나의 플랜에 담고,
          <br className="desktop-break" /> 이동 동선을 함께 보며 여행 계획을
          구성하세요.
        </p>
        <div className="hero-actions" aria-label="시작 메뉴">
          <a className="button button-primary" href="/map">
            시작하기
          </a>
          <a className="button button-secondary" href="#features">
            기능 보기
          </a>
        </div>
      </div>
      <HeroVisual />
    </section>
  );
}
