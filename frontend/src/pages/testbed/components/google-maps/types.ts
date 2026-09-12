import type { RouteLocation } from '@trasolve/shared';

export type Endpoint = { text: string; location?: RouteLocation };
export type IntermediateInput = { id: number; endpoint: Endpoint };
export type ApiStatus = 'idle' | 'loading' | 'success' | 'error';
