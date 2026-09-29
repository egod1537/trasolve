import {
  analyticsFunnelListResponseSchema,
  funnelAggregationFiltersSchema,
  type AnalyticsFunnelListResponse,
  type AnalyticsEvent,
  type FunnelAggregationFilters,
  type FunnelResult,
} from '@trasolve/shared';
import type { AnalyticsRepository } from '../analyticsEventRepository.js';
import { analyzeFunnel } from './funnelAnalysis.js';
import { analyzeTripShareAttribution } from './tripShareAttribution.js';
import {
  ANALYTICS_FUNNEL_IDS,
  PRIMARY_ANALYTICS_FUNNEL_IDS,
  SECONDARY_ANALYTICS_FUNNEL_IDS,
  findAnalyticsFunnelDefinition,
  getAnalyticsFunnelDefinition,
} from './funnelDefinitions.js';

export class FunnelNotFoundError extends Error {
  public constructor(public readonly funnelId: string) {
    super(`Unknown analytics funnel: ${funnelId}.`);
    this.name = 'FunnelNotFoundError';
  }
}

export class FunnelAggregationService {
  public constructor(private readonly repository: AnalyticsRepository) {}

  public listFunnels(): AnalyticsFunnelListResponse {
    return analyticsFunnelListResponseSchema.parse({
      funnels: [
        ...PRIMARY_ANALYTICS_FUNNEL_IDS,
        ...SECONDARY_ANALYTICS_FUNNEL_IDS,
      ].map((funnelId) => {
        const definition = getAnalyticsFunnelDefinition(funnelId);
        return {
          id: definition.id,
          nameKey: definition.name,
          stepCount: definition.steps.length,
          enabled: true,
        };
      }),
    });
  }

  public async aggregate(
    funnelId: string,
    filtersInput: FunnelAggregationFilters = {},
  ): Promise<FunnelResult> {
    const definition = findAnalyticsFunnelDefinition(funnelId);
    if (!definition) {
      throw new FunnelNotFoundError(funnelId);
    }
    const filters = funnelAggregationFiltersSchema.parse(filtersInput);
    const events: AnalyticsEvent[] = [];
    for await (const event of this.repository.queryRaw({
      ...(filters.from === undefined ? {} : { from: filters.from }),
      ...(filters.to === undefined ? {} : { to: filters.to }),
    })) {
      events.push(event);
    }
    const result = await analyzeFunnel(events, definition, filters);
    return definition.id === ANALYTICS_FUNNEL_IDS.tripShare
      ? {
          ...result,
          attribution: await analyzeTripShareAttribution(events, filters),
        }
      : result;
  }
}
