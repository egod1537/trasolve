import type { ApiHealth } from '../hooks/useApiHealth';
import { FeatureSection } from '../components/landing/FeatureSection';
import { Header } from '../components/landing/Header';
import { Hero } from '../components/landing/Hero';

interface LandingPageProps {
  apiHealth: ApiHealth;
}

const healthLabels: Record<ApiHealth, string> = {
  checking: '서비스 연결 상태 확인 중',
  available: '서비스 API 연결 가능',
  unavailable: '서비스 API 연결 불가',
};

export function LandingPage({ apiHealth }: LandingPageProps) {
  return (
    <div className="landing-page" data-api-health={apiHealth}>
      <Header />
      <main>
        <Hero />
        <FeatureSection />
      </main>
      <footer className="site-footer">
        <p>© {new Date().getFullYear()} Trasolve</p>
        <p>여행 계획 서비스는 현재 준비 중입니다.</p>
      </footer>
      <span className="sr-only" role="status" aria-live="polite">
        {healthLabels[apiHealth]}
      </span>
    </div>
  );
}
