import type { TrouteOptimizeRequest } from '@trasolve/shared';

export function createSampleRequest(): TrouteOptimizeRequest {
  return {
    job_id: `route-testbed-${crypto.randomUUID()}`,
    locations: [
      {
        id: 'start',
        place_id: 'SAMPLE_PLACE_ID_1',
        open_time: '09:00',
        close_time: '18:00',
        stay_minutes: 60,
      },
      {
        id: 'place-2',
        place_id: 'SAMPLE_PLACE_ID_2',
        open_time: '10:00',
        close_time: '19:00',
        stay_minutes: 90,
      },
    ],
    start_time: '09:00',
  };
}
