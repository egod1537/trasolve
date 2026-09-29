import {
  ANALYTICS_SCREENS,
  ANALYTICS_TARGETS,
  funnelDefinitionSchema,
  funnelStepConditionSchema,
  type FunnelDefinition,
} from '@trasolve/shared';

export const ANALYTICS_FUNNEL_IDS = {
  tripEntry: 'trip_entry',
  addPlace: 'add_place',
  routeOptimization: 'route_optimization',
  routeReoptimization: 'route_reoptimization',
  tripShare: 'trip_share',
} as const;

export type AnalyticsFunnelId =
  (typeof ANALYTICS_FUNNEL_IDS)[keyof typeof ANALYTICS_FUNNEL_IDS];

export const PRIMARY_ANALYTICS_FUNNEL_IDS = [
  ANALYTICS_FUNNEL_IDS.routeOptimization,
  ANALYTICS_FUNNEL_IDS.tripEntry,
  ANALYTICS_FUNNEL_IDS.addPlace,
] as const satisfies readonly AnalyticsFunnelId[];

export const SECONDARY_ANALYTICS_FUNNEL_IDS = [
  ANALYTICS_FUNNEL_IDS.routeReoptimization,
  ANALYTICS_FUNNEL_IDS.tripShare,
] as const satisfies readonly AnalyticsFunnelId[];

export const ROUTE_OPTIMIZATION_FUNNEL = defineFunnel({
  id: ANALYTICS_FUNNEL_IDS.routeOptimization,
  name: 'route_optimization',
  steps: [
    {
      id: 'map_workspace_viewed',
      label: 'map_workspace_viewed',
      eventType: 'screen_view',
      screen: ANALYTICS_SCREENS.mapWorkspace,
    },
    {
      id: 'optimization_started',
      label: 'optimization_started',
      eventType: 'optimize_start',
    },
    {
      id: 'optimization_completed',
      label: 'optimization_completed',
      eventType: 'optimize_complete',
    },
    {
      id: 'result_viewed',
      label: 'result_viewed',
      eventType: 'result_view',
    },
    {
      id: 'optimization_applied',
      label: 'optimization_applied',
      eventType: 'button_click',
      target: ANALYTICS_TARGETS.optimizeApply,
    },
  ],
});

const funnelDefinitions = [
  defineFunnel({
    id: ANALYTICS_FUNNEL_IDS.tripEntry,
    name: 'trip_entry',
    steps: [
      {
        id: 'landing_viewed',
        label: 'landing_viewed',
        eventType: 'screen_view',
        screen: ANALYTICS_SCREENS.landing,
      },
      {
        id: 'landing_action',
        label: 'landing_action',
        alternatives: [
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.landingLogin,
          },
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.landingEnterMap,
          },
        ],
      },
      {
        id: 'trip_picker_viewed',
        label: 'trip_picker_viewed',
        eventType: 'screen_view',
        screen: ANALYTICS_SCREENS.tripPicker,
      },
      {
        id: 'trip_opened',
        label: 'trip_opened',
        alternatives: [
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.tripCreate,
          },
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.tripSelect,
          },
        ],
      },
      {
        id: 'map_workspace_viewed',
        label: 'map_workspace_viewed',
        eventType: 'screen_view',
        screen: ANALYTICS_SCREENS.mapWorkspace,
      },
    ],
  }),
  defineFunnel({
    id: ANALYTICS_FUNNEL_IDS.addPlace,
    name: 'add_place',
    steps: [
      {
        id: 'place_search_viewed',
        label: 'place_search_viewed',
        eventType: 'screen_view',
        screen: ANALYTICS_SCREENS.placeSearch,
      },
      {
        id: 'place_selected',
        label: 'place_selected',
        eventType: 'button_click',
        target: ANALYTICS_TARGETS.placeSelect,
      },
      {
        id: 'add_place_clicked',
        label: 'add_place_clicked',
        eventType: 'button_click',
        target: ANALYTICS_TARGETS.addPlace,
      },
      {
        id: 'place_added',
        label: 'place_added',
        eventType: 'add_place',
        target: ANALYTICS_TARGETS.addPlace,
        metadata: { success: true },
      },
    ],
  }),
  ROUTE_OPTIMIZATION_FUNNEL,
  defineFunnel({
    id: ANALYTICS_FUNNEL_IDS.routeReoptimization,
    name: 'route_reoptimization',
    steps: [
      {
        id: 'initial_result_viewed',
        label: 'initial_result_viewed',
        eventType: 'result_view',
      },
      {
        id: 'route_modified',
        label: 'route_modified',
        alternatives: [
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.placeEdit,
          },
          {
            eventType: 'button_click',
            target: ANALYTICS_TARGETS.reorder,
          },
        ],
      },
      {
        id: 'reoptimization_started',
        label: 'reoptimization_started',
        eventType: 'optimize_start',
      },
      {
        id: 'reoptimization_completed',
        label: 'reoptimization_completed',
        eventType: 'optimize_complete',
      },
      {
        id: 'updated_result_viewed',
        label: 'updated_result_viewed',
        eventType: 'result_view',
      },
    ],
  }),
  defineFunnel({
    id: ANALYTICS_FUNNEL_IDS.tripShare,
    name: 'trip_share',
    steps: [
      {
        id: 'share_modal_opened',
        label: 'share_modal_opened',
        eventType: 'button_click',
        screen: ANALYTICS_SCREENS.mapWorkspace,
        target: ANALYTICS_TARGETS.shareOpen,
      },
      {
        id: 'share_enabled',
        label: 'share_enabled',
        eventType: 'share_enable',
        screen: ANALYTICS_SCREENS.shareTrip,
        target: ANALYTICS_TARGETS.shareToggle,
      },
      {
        id: 'share_link_copied',
        label: 'share_link_copied',
        eventType: 'share_link_copy',
        screen: ANALYTICS_SCREENS.shareTrip,
        target: ANALYTICS_TARGETS.copyShareLink,
      },
    ],
  }),
] as const satisfies readonly FunnelDefinition[];

export const TRIP_SHARE_VIEW_ATTRIBUTION = {
  id: 'trip_share_view_attribution',
  sourceFunnelId: ANALYTICS_FUNNEL_IDS.tripShare,
  sourceStepId: 'share_link_copied',
  conversion: funnelStepConditionSchema.parse({
    eventType: 'shared_trip_view',
    screen: ANALYTICS_SCREENS.sharedTripViewer,
  }),
  joinMode: 'cross_session_attribution',
  requiredAttributionField: 'shareId',
  status: 'enabled',
} as const;

export const ANALYTICS_FUNNEL_DEFINITIONS: ReadonlyMap<
  AnalyticsFunnelId,
  FunnelDefinition
> = createFunnelRegistry(funnelDefinitions);

export function getAnalyticsFunnelDefinition(
  funnelId: AnalyticsFunnelId,
): FunnelDefinition {
  const definition = findAnalyticsFunnelDefinition(funnelId);
  if (!definition) {
    throw new Error(`Unknown analytics funnel: ${funnelId}.`);
  }
  return definition;
}

export function findAnalyticsFunnelDefinition(
  funnelId: string,
): FunnelDefinition | undefined {
  return ANALYTICS_FUNNEL_DEFINITIONS.get(funnelId as AnalyticsFunnelId);
}

function defineFunnel(definition: FunnelDefinition): FunnelDefinition {
  return funnelDefinitionSchema.parse(definition);
}

function createFunnelRegistry(
  definitions: readonly FunnelDefinition[],
): ReadonlyMap<AnalyticsFunnelId, FunnelDefinition> {
  const registry = new Map<AnalyticsFunnelId, FunnelDefinition>();
  for (const definition of definitions) {
    const funnelId = definition.id as AnalyticsFunnelId;
    if (registry.has(funnelId)) {
      throw new Error(`Duplicate analytics funnel id: ${definition.id}.`);
    }
    registry.set(funnelId, definition);
  }
  return registry;
}
