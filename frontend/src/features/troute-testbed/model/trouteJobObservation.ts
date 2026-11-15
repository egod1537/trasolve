import { type TrouteJobState } from '@trasolve/shared';

import { mergeRemoteJob } from '@/entities/route-job';
import { getTrouteJobEventPath } from '@/features/troute-testbed/api/troute';

import type { TestbedJob } from '@/entities/route-job';
import { createTimelineId } from '@/entities/route-job';

import { type TrouteJobObservation } from '@/features/troute-testbed/model/useTrouteJobEventStream';

export function observeTrouteJob(
  local: TestbedJob,
  remote: TrouteJobState,
  observation: TrouteJobObservation,
): TestbedJob {
  const merged = mergeRemoteJob(local, remote, {
    updatedAt: observation.updatedAt,
    sequence: observation.sequence,
  });
  if (observation.source !== 'event') {
    return merged;
  }
  const eventPath = getTrouteJobEventPath(remote.job_id);
  const pairId = observation.eventId ?? createTimelineId();
  return {
    ...merged,
    timeline: [
      ...merged.timeline,
      {
        id: createTimelineId(),
        pairId,
        timestamp: observation.receivedAt,
        direction: 'RESPONSE',
        source: 'trasolve',
        target: 'testbed',
        method: 'SSE',
        path: eventPath,
        status: 200,
        headers: {
          event: observation.eventType ?? 'message',
          ...(observation.eventId
            ? { 'last-event-id': observation.eventId }
            : {}),
        },
        body: remote,
        raw: observation.rawData ?? '',
      },
    ],
  };
}
