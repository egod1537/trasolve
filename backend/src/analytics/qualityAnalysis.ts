import {
  ANALYTICS_DOMAIN_EVENT_TYPES,
  ANALYTICS_SCREENS,
  type AnalyticsEvent,
  type AnalyticsFlowNode,
  type AnalyticsQualityAnalysisResult,
  type AnalyticsScreen,
  type AnalyticsTarget,
  type FunnelStep,
} from '@trasolve/shared';
import {
  AnalyticsFlowAggregationError,
  buildAnalyticsSessionPaths,
  compareAnalyticsEvents,
  extractAnalyticsFlowNode,
  type AnalyticsFlowAggregationOptions,
} from './flowAggregation.js';
import { ROUTE_OPTIMIZATION_FUNNEL } from './funnels/funnelDefinitions.js';

export const DEFAULT_ANALYTICS_FUNNEL = ROUTE_OPTIMIZATION_FUNNEL.steps.flatMap(
  (step) => {
    const nodeId = toDefaultFlowNodeId(step);
    return nodeId === null ? [] : [nodeId];
  },
);

export type AnalyticsQualityAnalysisOptions =
  AnalyticsFlowAggregationOptions & {
    funnel?: readonly AnalyticsFlowNode['id'][];
  };

export type AnalyticsTargetAggregation = {
  readonly screen: AnalyticsScreen;
  readonly target: AnalyticsTarget;
  readonly events: number;
  readonly sessions: number;
  readonly convertedSessions: number;
  readonly conversionRate: number;
  readonly dropOffSessions: number;
  readonly dropOffRate: number;
  readonly backtrackCount: number;
  readonly backtrackSessions: number;
  readonly nextTransitions: readonly {
    readonly target: AnalyticsFlowNode['id'];
    readonly events: number;
    readonly sessions: number;
    readonly ratio: number;
  }[];
};

const validNodeIds = new Set<AnalyticsFlowNode['id']>([
  ...Object.values(ANALYTICS_SCREENS).map(
    (screen): AnalyticsFlowNode['id'] => `screen:${screen}`,
  ),
  ...ANALYTICS_DOMAIN_EVENT_TYPES.map(
    (eventType): AnalyticsFlowNode['id'] => `event:${eventType}`,
  ),
]);

export async function analyzeAnalyticsQuality(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  options: AnalyticsQualityAnalysisOptions = {},
): Promise<AnalyticsQualityAnalysisResult> {
  const funnel = [...(options.funnel ?? DEFAULT_ANALYTICS_FUNNEL)];
  validateFunnel(funnel);
  const paths = await buildAnalyticsSessionPaths(eventInput, options);
  const stageSessions = funnel.map(() => 0);
  const pathLengths: number[] = [];
  let backtrackCount = 0;
  let backtrackSessions = 0;

  for (const session of paths.sessions) {
    const nodeIds = session.nodes.map(({ id }) => id);
    pathLengths.push(nodeIds.length);
    countFunnelReach(nodeIds, funnel, stageSessions);

    const sessionBacktracks = countBacktracks(nodeIds);
    backtrackCount += sessionBacktracks;
    if (sessionBacktracks > 0) {
      backtrackSessions += 1;
    }
  }

  const stages = funnel.map((nodeId, index) => ({
    index,
    nodeId,
    sessions: stageSessions[index],
  }));
  const transitions = funnel.slice(1).map((target, index) => {
    const source = funnel[index];
    const sourceSessions = stageSessions[index];
    const convertedSessions = stageSessions[index + 1];
    const dropOffSessions = sourceSessions - convertedSessions;
    return {
      source,
      target,
      sourceSessions,
      convertedSessions,
      conversionRate:
        sourceSessions === 0 ? 0 : convertedSessions / sourceSessions,
      dropOffSessions,
      dropOffRate: sourceSessions === 0 ? 0 : dropOffSessions / sourceSessions,
    };
  });

  return {
    funnel: { stages, transitions },
    summary: {
      sessions: paths.sessions.length,
      events: paths.eventCount,
      avgPathLength: average(pathLengths),
      medianPathLength: median(pathLengths),
      backtrackCount,
      backtrackSessions,
    },
  };
}

export function aggregateAnalyticsTargets(
  events: readonly AnalyticsEvent[],
): readonly AnalyticsTargetAggregation[] {
  const groupedEvents = new Map<string, AnalyticsEvent[]>();
  for (const event of events) {
    const sessionEvents = groupedEvents.get(event.sessionId) ?? [];
    sessionEvents.push(event);
    groupedEvents.set(event.sessionId, sessionEvents);
  }

  const accumulators = new Map<
    string,
    {
      screen: AnalyticsScreen;
      target: AnalyticsTarget;
      events: number;
      sessions: Set<string>;
      convertedSessions: Set<string>;
      backtrackCount: number;
      backtrackSessions: Set<string>;
      nextTransitions: Map<
        AnalyticsFlowNode['id'],
        { events: number; sessions: Set<string> }
      >;
    }
  >();

  for (const [sessionId, sessionEvents] of groupedEvents) {
    sessionEvents.sort(compareAnalyticsEvents);
    const nextNodes = findNextAnalysisNodes(sessionEvents);
    const visitedNodes = new Set<AnalyticsFlowNode['id']>();

    for (let index = 0; index < sessionEvents.length; index += 1) {
      const event = sessionEvents[index];
      const node = extractAnalyticsFlowNode(event, 'mixed');
      if (node) {
        visitedNodes.add(node.id);
      }
      if (event.eventType !== 'button_click' || event.target === null) {
        continue;
      }
      const key = `${event.screen}\u0000${event.target}`;
      let accumulator = accumulators.get(key);
      if (!accumulator) {
        accumulator = {
          screen: event.screen,
          target: event.target,
          events: 0,
          sessions: new Set(),
          convertedSessions: new Set(),
          backtrackCount: 0,
          backtrackSessions: new Set(),
          nextTransitions: new Map(),
        };
        accumulators.set(key, accumulator);
      }
      accumulator.events += 1;
      accumulator.sessions.add(sessionId);

      const nextNode = nextNodes[index];
      if (!nextNode) {
        continue;
      }
      accumulator.convertedSessions.add(sessionId);
      const transition = accumulator.nextTransitions.get(nextNode.id);
      if (transition) {
        transition.events += 1;
        transition.sessions.add(sessionId);
      } else {
        accumulator.nextTransitions.set(nextNode.id, {
          events: 1,
          sessions: new Set([sessionId]),
        });
      }
      if (visitedNodes.has(nextNode.id)) {
        accumulator.backtrackCount += 1;
        accumulator.backtrackSessions.add(sessionId);
      }
    }
  }

  return [...accumulators.values()]
    .map((accumulator) => {
      const sessionCount = accumulator.sessions.size;
      const convertedSessions = accumulator.convertedSessions.size;
      const dropOffSessions = sessionCount - convertedSessions;
      return {
        screen: accumulator.screen,
        target: accumulator.target,
        events: accumulator.events,
        sessions: sessionCount,
        convertedSessions,
        conversionRate:
          sessionCount === 0 ? 0 : convertedSessions / sessionCount,
        dropOffSessions,
        dropOffRate: sessionCount === 0 ? 0 : dropOffSessions / sessionCount,
        backtrackCount: accumulator.backtrackCount,
        backtrackSessions: accumulator.backtrackSessions.size,
        nextTransitions: [...accumulator.nextTransitions]
          .map(([target, transition]) => ({
            target,
            events: transition.events,
            sessions: transition.sessions.size,
            ratio: transition.events / accumulator.events,
          }))
          .sort(
            (left, right) =>
              right.events - left.events ||
              left.target.localeCompare(right.target),
          )
          .slice(0, 5),
      };
    })
    .sort(
      (left, right) =>
        left.screen.localeCompare(right.screen) ||
        left.target.localeCompare(right.target),
    );
}

function findNextAnalysisNodes(
  events: readonly AnalyticsEvent[],
): readonly (ReturnType<typeof extractAnalyticsFlowNode> | null)[] {
  const nextNodes: Array<ReturnType<typeof extractAnalyticsFlowNode> | null> =
    Array.from({ length: events.length }, () => null);
  let nextNode: ReturnType<typeof extractAnalyticsFlowNode> = null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    nextNodes[index] = nextNode;
    nextNode = extractAnalyticsFlowNode(events[index], 'mixed') ?? nextNode;
  }
  return nextNodes;
}

function countFunnelReach(
  path: readonly AnalyticsFlowNode['id'][],
  funnel: readonly AnalyticsFlowNode['id'][],
  stageSessions: number[],
): void {
  let pathIndex = 0;
  for (let stageIndex = 0; stageIndex < funnel.length; stageIndex += 1) {
    while (pathIndex < path.length && path[pathIndex] !== funnel[stageIndex]) {
      pathIndex += 1;
    }
    if (pathIndex === path.length) {
      return;
    }
    stageSessions[stageIndex] += 1;
    pathIndex += 1;
  }
}

function countBacktracks(path: readonly AnalyticsFlowNode['id'][]): number {
  const visited = new Set<AnalyticsFlowNode['id']>();
  let previous: AnalyticsFlowNode['id'] | undefined;
  let count = 0;
  for (const nodeId of path) {
    if (nodeId !== previous && visited.has(nodeId)) {
      count += 1;
    }
    visited.add(nodeId);
    previous = nodeId;
  }
  return count;
}

function average(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function validateFunnel(funnel: readonly AnalyticsFlowNode['id'][]): void {
  if (funnel.length === 0) {
    throw new AnalyticsFlowAggregationError(
      'Analytics quality funnel must contain at least one node.',
    );
  }
  for (const nodeId of funnel) {
    if (!validNodeIds.has(nodeId)) {
      throw new AnalyticsFlowAggregationError(
        `Analytics quality funnel contains an unsupported node: ${nodeId}.`,
      );
    }
  }
}

function toDefaultFlowNodeId(step: FunnelStep): AnalyticsFlowNode['id'] | null {
  if (step.eventType === 'screen_view' && step.screen !== undefined) {
    return `screen:${step.screen}`;
  }
  if (
    step.eventType !== undefined &&
    ANALYTICS_DOMAIN_EVENT_TYPES.includes(
      step.eventType as (typeof ANALYTICS_DOMAIN_EVENT_TYPES)[number],
    )
  ) {
    return `event:${step.eventType as (typeof ANALYTICS_DOMAIN_EVENT_TYPES)[number]}`;
  }
  return null;
}
