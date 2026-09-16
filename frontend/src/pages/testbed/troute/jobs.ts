import type {
  TrouteJobState,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
} from '@trasolve/shared';
import type { TrouteGatewayResult } from '../../../api/troute';
import type { TimelineEntry } from './timeline';

export type TestbedJobStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Browser-session UI state; this is not a backend API contract. */
export interface TestbedJob {
  id: string;
  status: TestbedJobStatus;
  createdAt: number;
  completedAt?: number;
  progress: number;
  stage?: string;
  message?: string;
  error?: string;
  inspectionError?: string;
  cancelError?: string;
  request: TrouteOptimizeRequest;
  gatewayResponse?: TrouteGatewayResult;
  jobState?: TrouteJobState;
  timeline: TimelineEntry[];
}

export const JOB_STATUS_LABELS: Record<TestbedJobStatus, string> = {
  pending: '대기 중',
  running: '실행 중',
  completed: '완료',
  failed: '오류',
  cancelled: '취소됨',
};

export function getFinalOptimization(
  job: TestbedJob,
): TrouteOptimizeResponse | null {
  if (job.status === 'cancelled') {
    return null;
  }
  return job.jobState?.result ?? job.gatewayResponse?.optimization ?? null;
}

export function hasResultMismatch(job: TestbedJob): boolean {
  if (job.status === 'cancelled') {
    return false;
  }
  const inspected = job.jobState?.result;
  const gateway = job.gatewayResponse?.optimization;
  return (
    inspected !== null &&
    inspected !== undefined &&
    gateway !== null &&
    gateway !== undefined &&
    JSON.stringify(inspected) !== JSON.stringify(gateway)
  );
}
