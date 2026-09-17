import type {
  TrouteJobHistoryItem,
  TrouteJobState,
  TrouteOptimizeRequest,
  TrouteOptimizeResponse,
} from '@trasolve/shared';
import { isTrouteJobTerminalStatus } from '@trasolve/shared';
import type { TrouteGatewayResult } from '@/entities/route-job/model/gateway';
import type { TimelineEntry } from '@/entities/route-job/model/timeline';
import {
  areJsonValuesEqual,
  reuseJsonValue,
} from '@/shared/lib/structuralSharing';

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
  remoteUpdatedAt?: number;
  eventSequence?: number;
  timeline: TimelineEntry[];
}

type RemoteJobVersion = {
  updatedAt?: number;
  sequence?: number;
};

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
    !areJsonValuesEqual(inspected, gateway)
  );
}

export function selectTestbedJob(
  jobs: readonly TestbedJob[],
  selectedJobId: string | null,
): TestbedJob | null {
  return jobs.find((job) => job.id === selectedJobId) ?? null;
}

export function selectActiveJobId(job: TestbedJob | null): string | null {
  return job?.status === 'pending' || job?.status === 'running' ? job.id : null;
}

export function mergeRemoteJob(
  local: TestbedJob,
  remote: TrouteJobState,
  version: RemoteJobVersion = {},
): TestbedJob {
  if (
    isTrouteJobTerminalStatus(local.status) &&
    !isTrouteJobTerminalStatus(remote.status)
  ) {
    return local;
  }
  if (
    version.sequence !== undefined &&
    local.eventSequence !== undefined &&
    version.sequence <= local.eventSequence
  ) {
    return local;
  }
  if (
    version.updatedAt !== undefined &&
    local.remoteUpdatedAt !== undefined &&
    version.updatedAt < local.remoteUpdatedAt
  ) {
    return local;
  }

  const sharedRemote = reuseJsonValue(local.jobState, remote);
  const next: TestbedJob = {
    ...local,
    status: remote.status,
    progress: remote.progress,
    stage: remote.stage ?? undefined,
    message: remote.last_message ?? local.message,
    error: remote.error ? describeRemoteJobError(remote) : undefined,
    inspectionError: undefined,
    cancelError: undefined,
    jobState: sharedRemote,
    remoteUpdatedAt: version.updatedAt ?? local.remoteUpdatedAt,
    eventSequence: version.sequence ?? local.eventSequence,
    completedAt: isTrouteJobTerminalStatus(remote.status)
      ? (local.completedAt ?? Date.now())
      : local.completedAt,
  };
  return areJobsEquivalent(local, next) ? local : next;
}

export function mergeRemoteJobHistory(
  current: TestbedJob[],
  history: readonly TrouteJobHistoryItem[],
  localJobIds: ReadonlySet<string>,
): TestbedJob[] {
  const currentById = new Map(current.map((job) => [job.id, job]));
  const incomingIds = new Set(history.map((item) => item.state.job_id));
  const remoteJobs = history.map((item) => {
    const local = currentById.get(item.state.job_id);
    return local
      ? mergeRemoteHistoryItem(local, item)
      : remoteHistoryItemToJob(item);
  });
  const localOnly = current.filter(
    (job) => !incomingIds.has(job.id) && localJobIds.has(job.id),
  );
  const next = [...remoteJobs, ...localOnly].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
  return areJobListsEquivalent(current, next) ? current : next;
}

function mergeRemoteHistoryItem(
  local: TestbedJob,
  item: TrouteJobHistoryItem,
): TestbedJob {
  if (
    local.remoteUpdatedAt !== undefined &&
    item.updated_at < local.remoteUpdatedAt
  ) {
    return local;
  }
  const stateMerged = mergeRemoteJob(local, item.state, {
    updatedAt: item.updated_at,
  });
  if (
    stateMerged === local &&
    local.createdAt === item.created_at &&
    local.completedAt === (item.completed_at ?? undefined) &&
    areJsonValuesEqual(local.request, item.request)
  ) {
    return local;
  }
  const next: TestbedJob = {
    ...stateMerged,
    createdAt: item.created_at,
    completedAt: item.completed_at ?? undefined,
    request: reuseJsonValue(local.request, item.request),
  };
  return areJobsEquivalent(local, next) ? local : next;
}

function remoteHistoryItemToJob(item: TrouteJobHistoryItem): TestbedJob {
  return {
    id: item.state.job_id,
    status: item.state.status,
    createdAt: item.created_at,
    completedAt: item.completed_at ?? undefined,
    progress: item.state.progress,
    stage: item.state.stage ?? undefined,
    message: item.state.last_message ?? undefined,
    error: item.state.error ? describeRemoteJobError(item.state) : undefined,
    request: item.request,
    jobState: item.state,
    remoteUpdatedAt: item.updated_at,
    timeline: [],
  };
}

function describeRemoteJobError(job: TrouteJobState): string {
  if (!job.error) {
    return '';
  }
  return [job.error.code, job.error.message, job.error.detail]
    .filter(Boolean)
    .join(' · ');
}

function areJobListsEquivalent(
  current: readonly TestbedJob[],
  next: readonly TestbedJob[],
): boolean {
  return (
    current.length === next.length &&
    current.every((job, index) => job === next[index])
  );
}

function areJobsEquivalent(left: TestbedJob, right: TestbedJob): boolean {
  return areJsonValuesEqual(left, right);
}
