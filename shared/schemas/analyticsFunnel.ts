import { z } from 'zod';
import {
  analyticsEventMetadataSchema,
  analyticsEventTypeSchema,
  analyticsLocaleSchema,
  analyticsScreenSchema,
  analyticsTargetSchema,
} from './analytics.js';

const stableAnalyticsIdentifierSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/);

const funnelConditionShape = {
  eventType: analyticsEventTypeSchema.optional(),
  screen: analyticsScreenSchema.optional(),
  target: analyticsTargetSchema.optional(),
  metadata: analyticsEventMetadataSchema.optional(),
};

function hasFunnelCondition(condition: {
  eventType?: unknown;
  screen?: unknown;
  target?: unknown;
  metadata?: object;
}): boolean {
  return (
    condition.eventType !== undefined ||
    condition.screen !== undefined ||
    condition.target !== undefined ||
    (condition.metadata !== undefined &&
      Object.keys(condition.metadata).length > 0)
  );
}

export const funnelStepConditionSchema = z
  .strictObject(funnelConditionShape)
  .refine(hasFunnelCondition, {
    message: 'A funnel step condition must define at least one predicate.',
  });

export const funnelStepSchema = z
  .strictObject({
    id: stableAnalyticsIdentifierSchema,
    label: stableAnalyticsIdentifierSchema,
    ...funnelConditionShape,
    alternatives: z.array(funnelStepConditionSchema).min(2).optional(),
  })
  .refine(
    (step) => hasFunnelCondition(step) !== (step.alternatives !== undefined),
    {
      message:
        'A funnel step must define either direct conditions or alternatives, but not both.',
    },
  );

export const funnelDefinitionSchema = z
  .strictObject({
    id: stableAnalyticsIdentifierSchema,
    name: stableAnalyticsIdentifierSchema,
    description: z.string().min(1).max(256).optional(),
    steps: z.array(funnelStepSchema).min(1),
  })
  .superRefine((definition, context) => {
    const stepIds = new Set<string>();
    definition.steps.forEach((step, index) => {
      if (stepIds.has(step.id)) {
        context.addIssue({
          code: 'custom',
          message: `Duplicate funnel step id: ${step.id}.`,
          path: ['steps', index, 'id'],
        });
      }
      stepIds.add(step.id);
    });
  });

export const funnelAggregationFiltersSchema = z
  .strictObject({
    from: z.iso.datetime({ offset: false }).optional(),
    to: z.iso.datetime({ offset: false }).optional(),
    locale: analyticsLocaleSchema.optional(),
    authenticated: z.boolean().optional(),
  })
  .refine(
    (filters) =>
      filters.from === undefined ||
      filters.to === undefined ||
      Date.parse(filters.from) <= Date.parse(filters.to),
    {
      message: 'Funnel date range must have from less than or equal to to.',
      path: ['to'],
    },
  );

export const funnelStepResultSchema = z.strictObject({
  stepId: stableAnalyticsIdentifierSchema,
  enteredSessions: z.number().int().nonnegative(),
  conversionFromPrevious: z.number().min(0).max(1).nullable(),
  overallConversion: z.number().min(0).max(1),
  dropOffSessions: z.number().int().nonnegative(),
  dropOffRate: z.number().min(0).max(1),
  averageTimeFromPreviousMs: z.number().nonnegative().nullable(),
  medianTimeFromPreviousMs: z.number().nonnegative().nullable(),
});

export const tripShareAttributionResultSchema = z.strictObject({
  enabledSessions: z.number().int().nonnegative(),
  copiedSessions: z.number().int().nonnegative(),
  copiedShareIds: z.number().int().nonnegative(),
  viewedShareIds: z.number().int().nonnegative(),
  viewerSessions: z.number().int().nonnegative(),
  ownerSelfViewSessions: z.number().int().nonnegative(),
  externalViewerSessions: z.number().int().nonnegative(),
  anonymousViewerSessions: z.number().int().nonnegative(),
  enableToCopyConversion: z.number().min(0).max(1),
  copyToViewConversion: z.number().min(0).max(1),
  averageViewersPerSharedTrip: z.number().nonnegative(),
  averageTimeFromCopyToFirstViewMs: z.number().nonnegative().nullable(),
  medianTimeFromCopyToFirstViewMs: z.number().nonnegative().nullable(),
});

export const funnelResultSchema = z.strictObject({
  funnelId: stableAnalyticsIdentifierSchema,
  totalSessions: z.number().int().nonnegative(),
  averageCompletionTimeMs: z.number().nonnegative().nullable(),
  steps: z.array(funnelStepResultSchema),
  attribution: tripShareAttributionResultSchema.nullable(),
});

export const analyticsFunnelListResponseSchema = z.strictObject({
  funnels: z.array(
    z.strictObject({
      id: stableAnalyticsIdentifierSchema,
      nameKey: stableAnalyticsIdentifierSchema,
      stepCount: z.number().int().positive(),
      enabled: z.boolean(),
    }),
  ),
});

export const analyticsFunnelResultResponseSchema =
  funnelResultSchema.safeExtend({
    range: z.strictObject({
      from: z.iso.datetime({ offset: false }).nullable(),
      to: z.iso.datetime({ offset: false }).nullable(),
      locale: analyticsLocaleSchema.nullable(),
    }),
  });
