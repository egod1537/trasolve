import { lazy, type ComponentType } from 'react';
import { LandingPage } from '@/pages/landing/LandingPage';
import { L } from '@/shared/i18n';

const MapPage = lazy(() => import('@/pages/map/MapPage'));
const PublicSharePage = lazy(() => import('@/pages/share/PublicSharePage'));
const TestbedPage = lazy(() => import('@/pages/testbed/TestbedPage'));
const GoogleMapsTestPage = lazy(
  () => import('@/pages/testbed/GoogleMapsTestPage'),
);
const AiChatTestPage = lazy(() => import('@/pages/testbed/AiChatTestPage'));
const GoogleOAuthTestPage = lazy(
  () => import('@/pages/testbed/GoogleOAuthTestPage'),
);
const TrouteTestPage = lazy(() => import('@/pages/testbed/TrouteTestPage'));
const TcacheRouteTestPage = lazy(
  () => import('@/pages/testbed/TcacheRouteTestPage'),
);
const LocalizationTestPage = lazy(
  () => import('@/pages/testbed/LocalizationTestPage'),
);

type RouteDefinition = {
  Component: ComponentType;
  loadingLabel: string;
};

export const routes: Record<string, RouteDefinition> = {
  '/': {
    Component: LandingPage,
    get loadingLabel() {
      return L('common:routes.loadingLabel.pageLoading');
    },
  },
  '/map': {
    Component: MapPage,
    get loadingLabel() {
      return L('map:routes.loadingLabel.loadingTravelMap');
    },
  },
  '/testbed': {
    Component: TestbedPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingTestbedList');
    },
  },
  '/testbed/google-maps': {
    Component: GoogleMapsTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingGoogleMapsTestbed');
    },
  },
  '/testbed/ai-chat': {
    Component: AiChatTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingOurAiChatTestbed');
    },
  },
  '/testbed/google-oauth': {
    Component: GoogleOAuthTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingGoogleOauthTestPage');
    },
  },
  '/testbed/troute': {
    Component: TrouteTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.trouteIntegrationTestPageLoading');
    },
  },
  '/testbed/tcache-route': {
    Component: TcacheRouteTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingTcacheRouteTestPage');
    },
  },
  '/testbed/localization': {
    Component: LocalizationTestPage,
    get loadingLabel() {
      return L('testbed:routes.loadingLabel.loadingLocalizationTestbed');
    },
  },
};

export function resolveRoute(pathname: string): RouteDefinition {
  const path = pathname.replace(/\/$/, '') || '/';
  if (/^\/share\/[^/]+$/.test(path)) {
    return {
      Component: PublicSharePage,
      get loadingLabel() {
        return L('trip:publicSharePage.status.loading');
      },
    };
  }
  return routes[path] ?? routes['/'];
}
