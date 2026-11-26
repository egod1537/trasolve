import { withMobileLayout } from '@/shared/config/mobileLayout';
import { Component, useId, useRef, useState } from 'react';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  type AnalyticsTarget,
} from '@trasolve/shared';
import { checkApiHealth } from '@/shared/api/health';
import { FeatureSection } from '@/pages/landing/components/FeatureSection';
import { Header } from '@/pages/landing/components/Header';
import { Hero } from '@/pages/landing/components/Hero';
import { PlanningSection } from '@/pages/landing/components/PlanningSection';
import {
  DemoBadge,
  isDebugGuestMode,
  isDemoModeRequested,
  useCurrentUser,
  withDemoRequest,
} from '@/features/auth';
import { NL, useL, type Localize } from '@/shared/i18n';
import { trackEvent, useScreenView } from '@/shared/analytics';
import { LegalLinks } from '@/shared/ui/LegalLinks';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { IconButton } from '@/shared/ui/IconButton';
import { CloseIcon, FolderOpenIcon, RefreshIcon } from '@/shared/ui/icons';

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
    demo?: boolean;
  } | null;
  headerActionLabel: string;
  authLoading: boolean;
  heroPrimaryLabel: string;
  heroPrimaryTarget: AnalyticsTarget;
  onHeaderAction: () => void;
  onHeroPrimaryAction: () => void;
  onLogout: () => Promise<void>;
  demo: boolean;
};

export function LandingPage() {
  const L = useL();
  const {
    state,
    demoStatus,
    login,
    loginAsGuest,
    loginAsDemo,
    logout,
    authNotice,
  } = useCurrentUser();
  const debugGuestMode = isDebugGuestMode(window.location.search);
  const demoRequested = isDemoModeRequested();
  const demoEntryAvailable = Boolean(
    demoRequested && demoStatus?.available === true,
  );
  const [demoChoiceOpen, setDemoChoiceOpen] = useState(false);
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
    const mapPath = withMobileLayout(
      withDemoRequest(debugGuestMode ? '/map?debug=1' : '/map'),
    );
    if (state.status === 'signed-in') {
      if (state.user.demo && demoStatus?.hasPreviousActivity) {
        setDemoChoiceOpen(true);
        return;
      }
      if (
        !state.user.demo &&
        state.user.loginProvider === 'local' &&
        demoEntryAvailable
      ) {
        if (demoStatus?.hasPreviousActivity) {
          setDemoChoiceOpen(true);
        } else {
          void loginAsDemo(mapPath, { requested: demoRequested });
        }
        return;
      }
      trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
      window.location.assign(mapPath);
      return;
    }
    if (debugGuestMode) {
      trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
      void loginAsGuest(mapPath);
      return;
    }
    if (demoEntryAvailable) {
      if (demoStatus?.hasPreviousActivity) {
        setDemoChoiceOpen(true);
        return;
      }
      trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
      void loginAsDemo(mapPath, { requested: demoRequested });
      return;
    }
    trackLandingButton(ANALYTICS_TARGETS.landingLogin);
    void login(mapPath);
  };

  const handleHeaderAction = (): void => {
    if (state.status === 'signed-out') {
      if (debugGuestMode || demoEntryAvailable) {
        enterService();
        return;
      }
      trackLandingButton(ANALYTICS_TARGETS.landingLogin);
      void login();
      return;
    }
    enterService();
  };

  const enterSelectedDemo = (reset: boolean): void => {
    setDemoChoiceOpen(false);
    trackLandingButton(ANALYTICS_TARGETS.landingEnterMap);
    void loginAsDemo(withMobileLayout(withDemoRequest('/map')), {
      requested: demoRequested,
      reset,
    });
  };

  return (
    <>
      <LandingPageView
        L={L}
        authNotice={authNotice}
        headerProfile={
          state.status === 'signed-in'
            ? {
                displayName:
                  state.user.name ?? state.user.email ?? state.user.id,
                pictureUrl: state.user.pictureUrl,
                demo: state.user.demo,
              }
            : null
        }
        headerActionLabel={
          state.status === 'signed-out'
            ? debugGuestMode || demoEntryAvailable
              ? L('common:landing.action.startTrip')
              : L('common:landing.navigation.signIn')
            : L('common:header.text.goServices')
        }
        authLoading={state.status === 'loading'}
        heroPrimaryLabel={
          state.status === 'loading'
            ? L('auth:mapUserControls.tooltip.preparing')
            : state.status === 'signed-out' &&
                !debugGuestMode &&
                !demoEntryAvailable
              ? L('auth:loginDialog.signIn')
              : L('common:landing.action.planTrip')
        }
        heroPrimaryTarget={
          state.status === 'signed-in' || debugGuestMode || demoEntryAvailable
            ? ANALYTICS_TARGETS.landingEnterMap
            : ANALYTICS_TARGETS.landingLogin
        }
        onHeaderAction={handleHeaderAction}
        onHeroPrimaryAction={enterService}
        onLogout={logout}
        demo={state.status === 'signed-in' && state.user.demo === true}
      />
      <DemoChoiceDialog
        open={demoChoiceOpen}
        onClose={() => setDemoChoiceOpen(false)}
        onContinue={() => enterSelectedDemo(false)}
        onReset={() => enterSelectedDemo(true)}
      />
    </>
  );
}

function DemoChoiceDialog({
  open,
  onClose,
  onContinue,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onReset: () => void;
}) {
  const L = useL();
  const titleId = useId();
  const descriptionId = useId();
  const continueRef = useRef<HTMLButtonElement>(null);
  if (!open) {
    return null;
  }
  return (
    <Dialog
      className="landing-demo-choice"
      labelledBy={titleId}
      describedBy={descriptionId}
      initialFocusRef={continueRef}
      onClose={onClose}
    >
      <header className="landing-demo-choice-header">
        <span className="landing-demo-choice-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="6" cy="17" r="2" />
            <circle cx="18" cy="7" r="2" />
            <path d="M7.8 16.1 16.2 7.9" />
            <path d="M10 7H5v5" />
          </svg>
        </span>
        <div className="landing-demo-choice-heading">
          <span className="landing-demo-choice-eyebrow">{NL('DEMO')}</span>
          <h2 id={titleId}>{L('common:landing.demoChoice.title')}</h2>
        </div>
        <IconButton
          className="landing-demo-choice-close"
          variant="ghost"
          size="sm"
          icon={<CloseIcon />}
          aria-label={L('common:action.close')}
          onClick={onClose}
        />
      </header>
      <p id={descriptionId} className="landing-demo-choice-description">
        {L('common:landing.demoChoice.description')}
      </p>
      <div className="landing-demo-choice-actions">
        <Button
          ref={continueRef}
          className="landing-demo-choice-continue"
          variant="primary"
          startIcon={<FolderOpenIcon />}
          onClick={onContinue}
        >
          {L('common:landing.demoChoice.action.continue')}
        </Button>
        <Button startIcon={<RefreshIcon />} onClick={onReset}>
          {L('common:landing.demoChoice.action.resetAndStart')}
        </Button>
      </div>
    </Dialog>
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
      demo,
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
        {demo && <DemoBadge />}
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
          <PlanningSection />
        </main>
        <footer className="site-footer">
          <LegalLinks />
          <p>
            {NL('©')} {new Date().getFullYear()} {NL('Trasolve')}
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
