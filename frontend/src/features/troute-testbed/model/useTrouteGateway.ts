import {
  isTrouteJobTerminalStatus,
  type TrouteOptimizeRequest,
} from '@trasolve/shared';
import { useCallback } from 'react';

import {
  optimizeRouteWithTroute,
  TrouteNetworkError,
} from '@/features/troute-testbed/api/troute';

import { type HealthState } from '@/features/troute-testbed/components/AppHeader';

import { createTimelineId, type TimelineEntry } from '@/entities/route-job';
import {
  classifyGatewayResult,
  describeGatewayError,
} from '@/features/troute-testbed/model/gatewayResultModel';

import { L } from '@/shared/i18n';
import { type JobUpdate } from '@/features/troute-testbed/model/trouteTestbedTypes';

import type { RefObject, Dispatch, SetStateAction } from 'react';
type GatewayDependencies = {
  gatewayControllers: RefObject<Map<string, AbortController>>;
  updateJob: (id: string, update: JobUpdate) => void;
  setHealth: Dispatch<SetStateAction<HealthState>>;
};
export function useTrouteGateway({
  gatewayControllers,
  updateJob,
  setHealth,
}: GatewayDependencies) {
  const controllers = gatewayControllers.current;
  const executeJob = useCallback(
    async (request: TrouteOptimizeRequest, pairId: string): Promise<void> => {
      const controller = new AbortController();
      controllers.set(request.job_id, controller);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      if (controller.signal.aborted) {
        controllers.delete(request.job_id);
        return;
      }
      try {
        const result = await optimizeRouteWithTroute(
          request,
          controller.signal,
        );
        if (controller.signal.aborted) {
          return;
        }

        setHealth('online');
        const gatewayError = describeGatewayError(result);
        const gatewayOutcome = classifyGatewayResult(result);
        const responseEntry: TimelineEntry = {
          id: createTimelineId(),
          pairId,
          timestamp: Date.now(),
          direction: 'RESPONSE',
          source: 'trasolve',
          target: 'testbed',
          status: result.httpStatus,
          latencyMs: result.durationMs,
          body: result.responseBody,
          raw: result.rawResponse,
          ...(gatewayError ? { error: gatewayError } : {}),
        };

        updateJob(request.job_id, (job) => {
          const observed = {
            ...job,
            gatewayResponse: result,
            ...(gatewayError ? {} : { inspectionError: undefined }),
            timeline: [...job.timeline, responseEntry],
          };
          if (isTrouteJobTerminalStatus(job.status)) {
            return observed;
          }
          if (gatewayOutcome === 'accepted') {
            return observed;
          }
          return gatewayOutcome === 'client-rejected'
            ? {
                ...observed,
                status: 'failed' as const,
                completedAt: Date.now(),
                stage: 'failed',
                message: L(
                  'testbed:trouteTestbed.message.trasolveGatewayRequestFailed',
                ),
                error: gatewayError,
              }
            : gatewayError
              ? {
                  ...observed,
                  inspectionError: gatewayError,
                  message: L(
                    'testbed:trouteTestbed.message.gatewayResponseFailsButContinuesQuery',
                  ),
                }
              : {
                  ...observed,
                  status: 'completed' as const,
                  completedAt: Date.now(),
                  progress: 100,
                  stage: job.jobState?.stage ?? 'completed',
                  message:
                    job.jobState?.last_message ??
                    L(
                      'testbed:trouteTestbed.message.trasolveGatewayRequestCompleted',
                    ),
                };
        });
      } catch (cause) {
        if (controller.signal.aborted) {
          return;
        }

        const latencyMs =
          cause instanceof TrouteNetworkError ? cause.durationMs : undefined;
        const message =
          cause instanceof Error
            ? cause.message
            : L(
                'testbed:trouteTestbed.text.unknownErrorOccurredDuringTrasolveBackend',
              );
        setHealth('offline');
        updateJob(request.job_id, (job) => ({
          ...job,
          ...(isTrouteJobTerminalStatus(job.status)
            ? {}
            : {
                inspectionError: message,
                message: L(
                  'testbed:trouteTestbed.message.althoughGatewayConnectionLostRemoteJob',
                ),
              }),
          timeline: [
            ...job.timeline,
            {
              id: createTimelineId(),
              pairId,
              timestamp: Date.now(),
              direction: 'RESPONSE',
              source: 'trasolve',
              target: 'testbed',
              ...(latencyMs === undefined ? {} : { latencyMs }),
              error: message,
            },
          ],
        }));
      } finally {
        controllers.delete(request.job_id);
      }
    },
    [updateJob, setHealth, controllers],
  );
  return executeJob;
}
