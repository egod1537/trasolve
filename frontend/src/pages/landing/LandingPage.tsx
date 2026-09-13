import { Component } from 'react';
import { checkApiHealth } from '../../api/health';
import { FeatureSection } from './components/FeatureSection';
import { Header } from './components/Header';
import { Hero } from './components/Hero';

type ApiHealth = 'checking' | 'available' | 'unavailable';

interface LandingPageState {
  apiHealth: ApiHealth;
}

const healthLabels: Record<ApiHealth, string> = {
  checking: '서비스 연결 상태 확인 중',
  available: '서비스 API 연결 가능',
  unavailable: '서비스 API 연결 불가',
};

export class LandingPage extends Component<
  Record<string, never>,
  LandingPageState
> {
  public componentDidMount(): void {
    const request = new AbortController();
    this.request = request;
    void checkApiHealth(request.signal)
      .then((available) => {
        if (!request.signal.aborted) {
          this.setState({ apiHealth: available ? 'available' : 'unavailable' });
        }
      })
      .catch(() => {
        if (!request.signal.aborted) {
          this.setState({ apiHealth: 'unavailable' });
        }
      });
  }

  public componentWillUnmount(): void {
    this.request?.abort();
    this.request = null;
  }

  public render() {
    const { apiHealth } = this.state;
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

  public state: LandingPageState = { apiHealth: 'checking' };

  private request: AbortController | null = null;
}
