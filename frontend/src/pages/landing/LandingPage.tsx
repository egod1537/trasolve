import { Component } from 'react';
import { checkApiHealth } from '@/shared/api/health';
import { FeatureSection } from '@/pages/landing/components/FeatureSection';
import { Header } from '@/pages/landing/components/Header';
import { Hero } from '@/pages/landing/components/Hero';
import { NL, useL, type Localize } from '@/shared/i18n';

type ApiHealth = 'checking' | 'available' | 'unavailable';

interface LandingPageState {
  apiHealth: ApiHealth;
}

type LandingPageProps = { L: Localize };

export function LandingPage() {
  const L = useL();
  return <LandingPageView L={L} />;
}

class LandingPageView extends Component<LandingPageProps, LandingPageState> {
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
    const { L } = this.props;
    const { apiHealth } = this.state;
    const healthLabel = {
      checking: L(
        'common:landingPage.healthLabels.text.checkingServiceConnectionStatus',
      ),
      available: L(
        'common:landingPage.healthLabels.text.serviceApiConnectionPossible',
      ),
      unavailable: L(
        'common:landingPage.healthLabels.text.serviceApiConnectionNotPossible',
      ),
    }[apiHealth];
    return (
      <div className="landing-page" data-api-health={apiHealth}>
        <Header />
        <main>
          <Hero />
          <FeatureSection />
        </main>
        <footer className="site-footer">
          <p>
            {NL('©')} {new Date().getFullYear()} {NL('Trasolve')}
          </p>
          <p>
            {L(
              'common:landingPage.render.description.travelPlanningServiceCurrentlyPreparation',
            )}
          </p>
        </footer>
        <span className="sr-only" role="status" aria-live="polite">
          {healthLabel}
        </span>
      </div>
    );
  }

  public state: LandingPageState = { apiHealth: 'checking' };

  private request: AbortController | null = null;
}
