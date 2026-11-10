import type { TestbedJob } from '@/entities/route-job';

export type JobUpdate =
  Partial<TestbedJob> | ((current: TestbedJob) => TestbedJob);
