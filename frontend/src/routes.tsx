import { lazy, type ComponentType } from 'react';
import { LandingPage } from './pages/LandingPage';

const MapPage = lazy(() => import('./pages/MapPage'));
const TestbedPage = lazy(() => import('./pages/TestbedPage'));
const GoogleMapsTestPage = lazy(() => import('./pages/GoogleMapsTestPage'));
const AiChatTestPage = lazy(() => import('./pages/AiChatTestPage'));

type RouteDefinition = {
  Component: ComponentType;
  loadingLabel: string;
};

export const routes: Record<string, RouteDefinition> = {
  '/': {
    Component: LandingPage,
    loadingLabel: '페이지를 불러오고 있습니다.',
  },
  '/map': {
    Component: MapPage,
    loadingLabel: '여행 지도를 불러오고 있습니다.',
  },
  '/testbed': {
    Component: TestbedPage,
    loadingLabel: '테스트베드 목록을 불러오고 있습니다.',
  },
  '/testbed/google-maps': {
    Component: GoogleMapsTestPage,
    loadingLabel: 'Google Maps 테스트베드를 불러오고 있습니다.',
  },
  '/testbed/ai-chat': {
    Component: AiChatTestPage,
    loadingLabel: 'AI 채팅 테스트베드를 불러오고 있습니다.',
  },
};

export function resolveRoute(pathname: string): RouteDefinition {
  const path = pathname.replace(/\/$/, '') || '/';
  return routes[path] ?? routes['/'];
}
