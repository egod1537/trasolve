import type { z } from 'zod';
import type {
  analyticsDomainEventTypeSchema,
  analyticsEventMetadataSchema,
  analyticsEventRequestMetadataSchema,
  analyticsEventPageSchema,
  analyticsEventRequestSchema,
  analyticsEventSchema,
  analyticsEventTypeSchema,
  analyticsFlowResponseSchema,
  analyticsLocaleSchema,
  analyticsOverviewResponseSchema,
  analyticsScreenSchema,
  analyticsSessionPageSchema,
  analyticsSessionSummarySchema,
  analyticsTargetSchema,
} from '../schemas/analytics.js';

export type AnalyticsEventType = z.infer<typeof analyticsEventTypeSchema>;
export type AnalyticsLocale = z.infer<typeof analyticsLocaleSchema>;
export type AnalyticsScreen = z.infer<typeof analyticsScreenSchema>;
export type AnalyticsTarget = z.infer<typeof analyticsTargetSchema>;
export type AnalyticsEventMetadata = z.infer<
  typeof analyticsEventMetadataSchema
>;
export type AnalyticsEventRequestMetadata = z.infer<
  typeof analyticsEventRequestMetadataSchema
>;
export type AnalyticsEventRequest = z.infer<typeof analyticsEventRequestSchema>;
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsSessionSummary = z.infer<
  typeof analyticsSessionSummarySchema
>;
export type AnalyticsSessionPage = z.infer<typeof analyticsSessionPageSchema>;
export type AnalyticsEventPage = z.infer<typeof analyticsEventPageSchema>;
export type AnalyticsFlowResponse = z.infer<typeof analyticsFlowResponseSchema>;
export type AnalyticsOverviewResponse = z.infer<
  typeof analyticsOverviewResponseSchema
>;

export type AnalyticsFlowNodeMode = 'screen' | 'domain_event' | 'mixed';

export type AnalyticsDomainEventType = z.infer<
  typeof analyticsDomainEventTypeSchema
>;

export type AnalyticsFlowScreenNode = {
  readonly id: `screen:${AnalyticsScreen}`;
  readonly kind: 'screen';
  readonly screen: AnalyticsScreen;
  readonly count: number;
  readonly uniqueSessions: number;
};

export type AnalyticsFlowDomainEventNode = {
  readonly id: `event:${AnalyticsDomainEventType}`;
  readonly kind: 'domain_event';
  readonly eventType: AnalyticsDomainEventType;
  readonly count: number;
  readonly uniqueSessions: number;
};

export type AnalyticsFlowNode =
  AnalyticsFlowScreenNode | AnalyticsFlowDomainEventNode;

export type AnalyticsFlowEdge = {
  readonly source: AnalyticsFlowNode['id'];
  readonly target: AnalyticsFlowNode['id'];
  readonly count: number;
  readonly outgoingRatio: number;
  readonly uniqueSessions: number;
};

export type AnalyticsFlowSummary = {
  readonly eventCount: number;
  readonly sessionCount: number;
  readonly sessionsWithNodes: number;
  readonly emptySessionCount: number;
  readonly singleNodeSessionCount: number;
  readonly nodeOccurrenceCount: number;
  readonly transitionCount: number;
};

export type AnalyticsFlowResult = {
  readonly nodes: readonly AnalyticsFlowNode[];
  readonly edges: readonly AnalyticsFlowEdge[];
  readonly summary: AnalyticsFlowSummary;
};

export type AnalyticsFunnelStageResult = {
  readonly index: number;
  readonly nodeId: AnalyticsFlowNode['id'];
  readonly sessions: number;
};

export type AnalyticsFunnelTransitionResult = {
  readonly source: AnalyticsFlowNode['id'];
  readonly target: AnalyticsFlowNode['id'];
  readonly sourceSessions: number;
  readonly convertedSessions: number;
  readonly conversionRate: number;
  readonly dropOffSessions: number;
  readonly dropOffRate: number;
};

export type AnalyticsQualitySummary = {
  readonly sessions: number;
  readonly events: number;
  readonly avgPathLength: number;
  readonly medianPathLength: number;
  readonly backtrackCount: number;
  readonly backtrackSessions: number;
};

export type AnalyticsQualityAnalysisResult = {
  readonly funnel: {
    readonly stages: readonly AnalyticsFunnelStageResult[];
    readonly transitions: readonly AnalyticsFunnelTransitionResult[];
  };
  readonly summary: AnalyticsQualitySummary;
};
