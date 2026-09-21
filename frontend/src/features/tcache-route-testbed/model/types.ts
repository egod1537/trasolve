export type TcacheRouteJobStatus =
  'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type TcacheHealthState = 'checking' | 'online' | 'offline';

export type TcacheStreamState =
  'idle' | 'connecting' | 'connected' | 'retrying' | 'disconnected';

export interface TcacheRouteLocation {
  id: string;
  name: string;
  placeId?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface TcacheRouteRequest {
  locations: TcacheRouteLocation[];
  mode: TcacheRouteMode;
  departureTime: string;
  computeAlternativeRoutes?: boolean;
  languageCode?: string;
  regionCode?: string;
  routingPreference?: string;
  units?: string;
}

export type TcacheRouteMode = 'DRIVING' | 'WALKING' | 'BICYCLING' | 'TRANSIT';

export interface TcacheRoutePoint {
  lat: number;
  lng: number;
}

export interface TcacheRouteBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface TcacheRouteLeg {
  from: string;
  to: string;
  distanceMeters?: number;
  durationSeconds?: number;
  start?: TcacheRoutePoint;
  end?: TcacheRoutePoint;
  path?: TcacheRoutePoint[];
}

export interface TcacheRouteAlternative {
  id: string;
  label: string;
  distanceMeters?: number;
  durationSeconds?: number;
  provider?: string;
  path: TcacheRoutePoint[];
  bounds?: TcacheRouteBounds;
  legs: TcacheRouteLeg[];
}

export interface TcacheRouteResult {
  routeCount: number;
  distanceMeters?: number;
  durationSeconds?: number;
  provider?: string;
  cacheStatus?: 'hit' | 'miss' | 'unknown';
  latencyMs?: number;
  legs: TcacheRouteLeg[];
  routes: TcacheRouteAlternative[];
  raw: unknown;
}

export interface TcacheProgressEvent {
  stage: string;
  progress: number;
  message?: string;
  timestamp: number;
}

export interface TcacheTimelineEntry {
  id: string;
  pairId?: string;
  timestamp: number;
  direction: string;
  source?: string;
  target?: string;
  method?: string;
  event?: string;
  label: string;
  path?: string;
  status?: number;
  latencyMs?: number;
  body?: unknown;
  raw?: string;
  error?: string;
}

export interface TcacheRouteJob {
  id: string;
  status: TcacheRouteJobStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  stage?: string;
  progress: number;
  message?: string;
  sseState?: TcacheStreamState;
  eventsUrl?: string;
  statusUrl?: string;
  resultUrl?: string;
  provider?: string;
  cacheStatus?: 'hit' | 'miss' | 'unknown';
  request: TcacheRouteRequest;
  progressEvent?: TcacheProgressEvent;
  result?: TcacheRouteResult;
  error?: string;
  timeline: TcacheTimelineEntry[];
}

export function isActiveTcacheJob(job: TcacheRouteJob): boolean {
  return job.status === 'queued' || job.status === 'running';
}
