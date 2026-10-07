import { Component } from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type AnalyticsTarget,
} from '@trasolve/shared';
import { checkApiHealth } from '@/shared/api/health';
import { FeatureSection } from '@/pages/landing/components/FeatureSection';
import { Header } from '@/pages/landing/components/Header';
import { Hero } from '@/pages/landing/components/Hero';
import { isDebugGuestMode, useCurrentUser } from '@/features/auth';
import { NL, useL, type Localize } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';

type ApiHealth = 'checking' | 'available' | 'unavailable';

interface LandingPageState {
  apiHealth: ApiHealth;
}

type LandingPageProps = {
  L: Localize;
  authNotice: string | null;
  headerProfile: {
    displayName: string;
    pictureUrl?: string;
  } | null;
  headerActionLabel: string;
  authLoading: boolean;
  heroPrimaryLabel: string;
  heroPrimaryTarget: AnalyticsTarget;
  onHeaderAction: () => void;
  onHeroPrimaryAction: () => void;
  onLogout: () => Promise<void>;
};

export function LandingPage() {
  const L = useL();
  const { state, login, loginAsGuest, logout, authNotice } = useCurrentUser();
  const debugGuestMode = isDebugGuestMode(window.location.search);
  useScreenView(ANALYTICS_SCREENS.landing);

  const trackLandingButton = (target: AnalyticsTarget): void => {
    trackEvent({
      eventType: 'button_click',
      screen: ANALYTICS_SCREENS.landing,
      target,
    });
  };

  const enterService = (): void => {
    if (state.status === 'loading') {
      return;
    }
    const mapPath = debugGuestMode ? '/map?debug=1' : '/map';
    if (state.status === 'signed-in') {
      trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
      window.location.assign(mapPath);
      return;
    }
    if (debugGuestMode) {
      trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
      void loginAsGuest(mapPath);
      return;
    }
    trackLandingButton(ANALYTICS_TARGETS.landingLogin);
    void login('/map');
  };

  const handleHeaderAction = (): void => {
    if (state.status === 'signed-out') {
      if (debugGuestMode) {
        enterService();
        return;
      }
      trackLandingButton(ANALYTICS_TARGETS.landingLogin);
      void login();
      return;
    }
    enterService();
  };

  return (
    <LandingPageView
      L={L}
      authNotice={authNotice}
      headerProfile={
        state.status === 'signed-in'
          ? {
              displayName: state.user.name ?? state.user.email,
              pictureUrl: state.user.pictureUrl,
            }
          : null
      }
      headerActionLabel={
        state.status === 'signed-out'
          ? debugGuestMode
            ? L('common:hero.text.gettingStarted')
            : L('auth:mapUserControls.text.signGoogle')
          : L('common:header.text.goServices')
      }
      authLoading={state.status === 'loading'}
      heroPrimaryLabel={
        state.status === 'loading'
          ? L('auth:mapUserControls.tooltip.preparing')
          : state.status === 'signed-out'
            ? debugGuestMode
              ? L('common:hero.text.gettingStarted')
              : L('auth:mapUserControls.text.signGoogle')
            : L('common:hero.text.gettingStarted')
      }
      heroPrimaryTarget={
        state.status === 'signed-in' || debugGuestMode
          ? ANALYTICS_TARGETS.landingEnterMap
          : ANALYTICS_TARGETS.landingLogin
      }
      onHeaderAction={handleHeaderAction}
      onHeroPrimaryAction={enterService}
      onLogout={logout}
    />
  );
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
    const {
      L,
      authNotice,
      headerProfile,
      headerActionLabel,
      authLoading,
      heroPrimaryLabel,
      heroPrimaryTarget,
      onHeaderAction,
      onHeroPrimaryAction,
      onLogout,
    } = this.props;
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
        <Header
          actionLabel={headerActionLabel}
          actionDisabled={authLoading}
          profile={headerProfile}
          onAction={onHeaderAction}
          onLogout={onLogout}
        />
        <main>
          <Hero
            authNotice={authNotice}
            primaryActionLabel={heroPrimaryLabel}
            primaryActionTarget={heroPrimaryTarget}
            primaryActionDisabled={authLoading}
            onPrimaryAction={onHeroPrimaryAction}
          />
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
