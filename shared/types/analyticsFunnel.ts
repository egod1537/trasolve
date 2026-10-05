import type { z } from 'zod';
import type {
  analyticsFunnelListResponseSchema,
  analyticsFunnelResultResponseSchema,
  funnelAggregationFiltersSchema,
  funnelDefinitionSchema,
  funnelResultSchema,
  funnelStepConditionSchema,
  funnelStepResultSchema,
  funnelStepSchema,
  tripShareAttributionResultSchema,
} from '../schemas/analyticsFunnel.js';

export type FunnelStepCondition = z.infer<typeof funnelStepConditionSchema>;
export type FunnelStep = z.infer<typeof funnelStepSchema>;
export type FunnelDefinition = z.infer<typeof funnelDefinitionSchema>;

export type FunnelAggregationFilters = z.infer<
  typeof funnelAggregationFiltersSchema
>;

export type FunnelStepResult = z.infer<typeof funnelStepResultSchema>;

export type FunnelResult = z.infer<typeof funnelResultSchema>;

export type TripShareAttributionResult = z.infer<
  typeof tripShareAttributionResultSchema
>;

export type AnalyticsFunnelListResponse = z.infer<
  typeof analyticsFunnelListResponseSchema
>;

export type AnalyticsFunnelResultResponse = z.infer<
  typeof analyticsFunnelResultResponseSchema
>;

export type FunnelMatchedStep = {
  readonly stepId: string;
  readonly eventId: string;
  readonly timestamp: string;
};

export type FunnelSessionProgression = {
  readonly sessionId: string;
  readonly matchedSteps: readonly FunnelMatchedStep[];
  readonly completed: boolean;
};

export type FunnelProgressionResult = {
  readonly funnelId: string;
  readonly totalSessions: number;
  readonly sessions: readonly FunnelSessionProgression[];
};
