import { z } from 'zod';
import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
} from '../constants/analytics.js';
import { trouteTravelModeSchema } from './troute.js';
import {
  shareAttributionIdSchema,
  shareViewerTypeSchema,
} from './tripSharing.js';

export const ANALYTICS_EVENT_TYPES = [
  'screen_view',
  'button_click',
  'add_place',
  'remove_place',
  'optimize_start',
  'optimize_complete',
  'result_view',
  'share_enable',
  'share_link_copy',
  'shared_trip_view',
] as const;

export const ANALYTICS_DOMAIN_EVENT_TYPES = [
  'add_place',
  'remove_place',
  'optimize_start',
  'optimize_complete',
  'result_view',
  'share_enable',
  'share_link_copy',
  'shared_trip_view',
] as const;

export const analyticsEventTypeSchema = z.enum(ANALYTICS_EVENT_TYPES);
export const analyticsDomainEventTypeSchema = z.enum(
  ANALYTICS_DOMAIN_EVENT_TYPES,
);
export const analyticsScreenSchema = z.enum(ANALYTICS_SCREENS);
export const analyticsTargetSchema = z.enum(ANALYTICS_TARGETS);

export const ANALYTICS_METADATA_SOURCES = [
  'blank',
  'google_place_card',
  'layer_detail',
  'map_detail',
  'route_optimization',
  'saved_trip',
  'seoul_example',
  'tokyo_example',
] as const;

export const ANALYTICS_DURATION_BUCKETS = [
  'under_1s',
  '1s_to_3s',
  '3s_to_10s',
  '10s_to_30s',
  '30s_or_more',
] as const;

export const ANALYTICS_LOCALES = ['ko', 'ja', 'en', 'mn'] as const;
export const analyticsLocaleSchema = z.enum(ANALYTICS_LOCALES);

/**
 * Analytics metadata is an allowlist of non-sensitive, analysis-ready values.
 * Strict object validation rejects user-authored fields such as trip titles,
 * memos, raw search queries, email addresses, and OAuth/session credentials.
 */
const analyticsClientMetadataShape = {
  locale: analyticsLocaleSchema.optional(),
  travelMode: trouteTravelModeSchema.optional(),
  resultCount: z.number().int().nonnegative().max(100_000).optional(),
  success: z.boolean().optional(),
  enabled: z.boolean().optional(),
  source: z.enum(ANALYTICS_METADATA_SOURCES).optional(),
  durationBucket: z.enum(ANALYTICS_DURATION_BUCKETS).optional(),
  errorCode: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/)
    .optional(),
  shareId: shareAttributionIdSchema.optional(),
  viewerType: shareViewerTypeSchema.optional(),
};

export const analyticsEventRequestMetadataSchema = z.strictObject(
  analyticsClientMetadataShape,
);

export const analyticsEventMetadataSchema = z.strictObject({
  ...analyticsClientMetadataShape,
});

export const ANALYTICS_EVENT_BODY_LIMIT = 16 * 1024;

/**
 * Browser-to-backend analytics payload. Identity and event IDs are deliberately
 * absent: the backend resolves userId and generates id after validation.
 */
export const analyticsEventRequestSchema = z
  .strictObject({
    sessionId: z.string().min(1),
    eventType: analyticsEventTypeSchema,
    screen: analyticsScreenSchema,
    target: analyticsTargetSchema.nullable().optional(),
    timestamp: z.iso.datetime({ offset: false }),
    metadata: analyticsEventRequestMetadataSchema.nullable().optional(),
  })
  .superRefine(validateShareAttributionMetadata);

/**
 * Source-of-truth raw analytics event. Persisted events are append-only; derived
 * analytics must be rebuilt from these events instead of mutating raw records.
 */
export const analyticsEventSchema = z
  .strictObject({
    id: z.uuid(),
    sessionId: z.string().min(1),
    userId: z.uuid().nullable(),
    eventType: analyticsEventTypeSchema,
    screen: analyticsScreenSchema,
    target: analyticsTargetSchema.nullable(),
    timestamp: z.iso.datetime({ offset: false }),
    metadata: analyticsEventMetadataSchema.nullable(),
  })
  .superRefine((event, context) => {
    validateShareAttributionMetadata(event, context);
    const isOwnerOutcome =
      event.eventType === 'share_enable' ||
      event.eventType === 'share_link_copy';
    if (isOwnerOutcome && event.userId === null) {
      context.addIssue({
        code: 'custom',
        path: ['userId'],
        message: 'Share owner outcome events require an authenticated user.',
      });
    }
    if (
      event.eventType === 'shared_trip_view' &&
      (event.userId === null) !== (event.metadata?.viewerType === 'anonymous')
    ) {
      context.addIssue({
        code: 'custom',
        path: ['metadata', 'viewerType'],
        message: 'Shared Trip viewerType must match backend authentication.',
      });
    }
  });

function validateShareAttributionMetadata(
  event: {
    eventType: (typeof ANALYTICS_EVENT_TYPES)[number];
    metadata?: {
      shareId?: string;
      viewerType?: z.infer<typeof shareViewerTypeSchema>;
    } | null;
  },
  context: z.RefinementCtx,
): void {
  const isShareAttributionEvent =
    event.eventType === 'share_enable' ||
    event.eventType === 'share_link_copy' ||
    event.eventType === 'shared_trip_view';
  if (isShareAttributionEvent && event.metadata?.shareId === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['metadata', 'shareId'],
      message: 'Share attribution events require a privacy-safe shareId.',
    });
  }
  if (!isShareAttributionEvent && event.metadata?.shareId !== undefined) {
    context.addIssue({
      code: 'custom',
      path: ['metadata', 'shareId'],
      message: 'shareId is only valid for share attribution events.',
    });
  }
  if (
    event.eventType === 'shared_trip_view' &&
    event.metadata?.viewerType === undefined
  ) {
    context.addIssue({
      code: 'custom',
      path: ['metadata', 'viewerType'],
      message: 'Shared Trip views require a backend-derived viewerType.',
    });
  }
  if (
    event.eventType !== 'shared_trip_view' &&
    event.metadata?.viewerType !== undefined
  ) {
    context.addIssue({
      code: 'custom',
      path: ['metadata', 'viewerType'],
      message: 'viewerType is only valid for Shared Trip views.',
    });
  }
}

export const analyticsSessionSummarySchema = z.strictObject({
  sessionId: z.string().min(1),
  startedAt: z.iso.datetime({ offset: false }),
  endedAt: z.iso.datetime({ offset: false }),
  eventCount: z.number().int().nonnegative(),
  pathLength: z.number().int().nonnegative(),
  userIds: z.array(z.uuid()),
  hasAnonymousEvents: z.boolean(),
});

export const analyticsSessionPageSchema = z.strictObject({
  sessions: z.array(analyticsSessionSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const analyticsEventPageSchema = z.strictObject({
  events: z.array(analyticsEventSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const analyticsFlowResponseSchema = z.strictObject({
  summary: z.strictObject({
    sessions: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    avgPathLength: z.number().nonnegative(),
  }),
  nodes: z.array(
    z.discriminatedUnion('kind', [
      z.strictObject({
        id: z.string().startsWith('screen:'),
        kind: z.literal('screen'),
        identifier: analyticsScreenSchema,
        visits: z.number().int().positive(),
        sessions: z.number().int().positive(),
      }),
      z.strictObject({
        id: z.string().startsWith('event:'),
        kind: z.literal('domain_event'),
        identifier: analyticsDomainEventTypeSchema,
        visits: z.number().int().positive(),
        sessions: z.number().int().positive(),
      }),
    ]),
  ),
  edges: z.array(
    z.strictObject({
      source: z.string().min(1),
      target: z.string().min(1),
      count: z.number().int().positive(),
      ratio: z.number().min(0).max(1),
      sessions: z.number().int().positive(),
    }),
  ),
});

const analyticsFlowNodeIdSchema = z
  .string()
  .regex(/^(screen|event):[a-z0-9_]+$/);

export const analyticsOverviewResponseSchema = z.strictObject({
  summary: z.strictObject({
    sessions: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    avgPathLength: z.number().nonnegative(),
    medianPathLength: z.number().nonnegative(),
    backtrackCount: z.number().int().nonnegative(),
    backtrackSessions: z.number().int().nonnegative(),
  }),
  funnel: z.strictObject({
    stages: z.array(
      z.strictObject({
        index: z.number().int().nonnegative(),
        nodeId: analyticsFlowNodeIdSchema,
        sessions: z.number().int().nonnegative(),
      }),
    ),
    transitions: z.array(
      z.strictObject({
        source: analyticsFlowNodeIdSchema,
        target: analyticsFlowNodeIdSchema,
        sourceSessions: z.number().int().nonnegative(),
        convertedSessions: z.number().int().nonnegative(),
        conversionRate: z.number().min(0).max(1),
        dropOffSessions: z.number().int().nonnegative(),
        dropOffRate: z.number().min(0).max(1),
      }),
    ),
  }),
  targets: z.array(
    z.strictObject({
      screen: analyticsScreenSchema,
      target: analyticsTargetSchema,
      events: z.number().int().positive(),
      sessions: z.number().int().positive(),
      convertedSessions: z.number().int().nonnegative(),
      conversionRate: z.number().min(0).max(1),
      dropOffSessions: z.number().int().nonnegative(),
      dropOffRate: z.number().min(0).max(1),
      backtrackCount: z.number().int().nonnegative(),
      backtrackSessions: z.number().int().nonnegative(),
      nextTransitions: z.array(
        z.strictObject({
          target: analyticsFlowNodeIdSchema,
          events: z.number().int().positive(),
          sessions: z.number().int().positive(),
          ratio: z.number().min(0).max(1),
        }),
      ),
    }),
  ),
});
