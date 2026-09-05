import { lazy, type ComponentType } from 'react';
import { useApiHealth } from './hooks/useApiHealth';
import { LandingPage } from './pages/LandingPage';

const MapPage = lazy(() => import('./pages/MapPage'));

function LandingRoute() {
  const apiHealth = useApiHealth();
  return <LandingPage apiHealth={apiHealth} />;
}

type RouteDefinition = {
  Component: ComponentType;
  loadingLabel: string;
};

export const routes: Record<string, RouteDefinition> = {
  '/': {
    Component: LandingRoute,
    loadingLabel: '페이지를 불러오고 있습니다.',
  },
  '/map': {
    Component: MapPage,
    loadingLabel: '여행 지도를 불러오고 있습니다.',
  },
};

export function resolveRoute(pathname: string): RouteDefinition {
  const path = pathname.replace(/\/$/, '') || '/';
  return routes[path] ?? routes['/'];
}
