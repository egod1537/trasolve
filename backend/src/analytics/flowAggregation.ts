import {
  ANALYTICS_DOMAIN_EVENT_TYPES,
  analyticsEventSchema,
  type AnalyticsDomainEventType,
  type AnalyticsEvent,
  type AnalyticsFlowDomainEventNode,
  type AnalyticsFlowEdge,
  type AnalyticsFlowNode,
  type AnalyticsFlowNodeMode,
  type AnalyticsFlowResult,
  type AnalyticsFlowScreenNode,
  type AnalyticsScreen,
} from '@trasolve/shared';

const domainEventTypes = new Set<AnalyticsDomainEventType>(
  ANALYTICS_DOMAIN_EVENT_TYPES,
);

export type AnalyticsFlowAggregationOptions = {
  nodeMode?: AnalyticsFlowNodeMode;
  collapseConsecutiveNodes?: boolean;
};

export type AnalyticsFlowNodeIdentity =
  | Pick<AnalyticsFlowScreenNode, 'id' | 'kind' | 'screen'>
  | Pick<AnalyticsFlowDomainEventNode, 'id' | 'kind' | 'eventType'>;

export type AnalyticsSessionPath = {
  readonly sessionId: string;
  readonly nodes: readonly AnalyticsFlowNodeIdentity[];
};

export type AnalyticsSessionPathCollection = {
  readonly eventCount: number;
  readonly sessions: readonly AnalyticsSessionPath[];
};

type NodeAccumulator = {
  readonly node: AnalyticsFlowNodeIdentity;
  count: number;
  readonly sessions: Set<string>;
};

type EdgeAccumulator = {
  readonly source: AnalyticsFlowNode['id'];
  readonly target: AnalyticsFlowNode['id'];
  count: number;
  readonly sessions: Set<string>;
};

export class AnalyticsFlowAggregationError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AnalyticsFlowAggregationError';
  }
}

export async function buildAnalyticsSessionPaths(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  options: AnalyticsFlowAggregationOptions = {},
): Promise<AnalyticsSessionPathCollection> {
  const nodeMode = options.nodeMode ?? 'mixed';
  const collapseConsecutiveNodes = options.collapseConsecutiveNodes ?? true;
  validateOptions(nodeMode, collapseConsecutiveNodes);

  const groupedEvents = new Map<string, AnalyticsEvent[]>();
  let eventCount = 0;
  for await (const eventValue of eventInput) {
    const parsed = analyticsEventSchema.safeParse(eventValue);
    if (!parsed.success) {
      throw new AnalyticsFlowAggregationError(
        `Analytics flow input event at index ${eventCount} is invalid.`,
        { cause: parsed.error },
      );
    }
    eventCount += 1;
    const events = groupedEvents.get(parsed.data.sessionId) ?? [];
    events.push(parsed.data);
    groupedEvents.set(parsed.data.sessionId, events);
  }

  const sessions = [...groupedEvents.keys()]
    .sort(compareText)
    .map((sessionId) => {
      const events = groupedEvents.get(sessionId)!;
      events.sort(compareAnalyticsEvents);
      return {
        sessionId,
        nodes: buildPath(events, nodeMode, collapseConsecutiveNodes),
      };
    });
  return { eventCount, sessions };
}

export async function aggregateAnalyticsFlow(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  options: AnalyticsFlowAggregationOptions = {},
): Promise<AnalyticsFlowResult> {
  const paths = await buildAnalyticsSessionPaths(eventInput, options);

  const nodeAccumulators = new Map<AnalyticsFlowNode['id'], NodeAccumulator>();
  const edgeAccumulators = new Map<string, EdgeAccumulator>();
  const outgoingCounts = new Map<AnalyticsFlowNode['id'], number>();
  let sessionsWithNodes = 0;
  let emptySessionCount = 0;
  let singleNodeSessionCount = 0;
  let nodeOccurrenceCount = 0;
  let transitionCount = 0;

  for (const { sessionId, nodes: path } of paths.sessions) {
    if (path.length === 0) {
      emptySessionCount += 1;
      continue;
    }
    sessionsWithNodes += 1;
    if (path.length === 1) {
      singleNodeSessionCount += 1;
    }

    for (const node of path) {
      nodeOccurrenceCount += 1;
      const accumulator = nodeAccumulators.get(node.id);
      if (accumulator) {
        accumulator.count += 1;
        accumulator.sessions.add(sessionId);
      } else {
        nodeAccumulators.set(node.id, {
          node,
          count: 1,
          sessions: new Set([sessionId]),
        });
      }
    }

    for (let index = 1; index < path.length; index += 1) {
      const source = path[index - 1].id;
      const target = path[index].id;
      const edgeKey = `${source}\u0000${target}`;
      transitionCount += 1;
      outgoingCounts.set(source, (outgoingCounts.get(source) ?? 0) + 1);
      const accumulator = edgeAccumulators.get(edgeKey);
      if (accumulator) {
        accumulator.count += 1;
        accumulator.sessions.add(sessionId);
      } else {
        edgeAccumulators.set(edgeKey, {
          source,
          target,
          count: 1,
          sessions: new Set([sessionId]),
        });
      }
    }
  }

  const nodes = [...nodeAccumulators.values()]
    .map(toFlowNode)
    .sort((left, right) => compareText(left.id, right.id));
  const edges = [...edgeAccumulators.values()]
    .map((edge): AnalyticsFlowEdge => ({
      source: edge.source,
      target: edge.target,
      count: edge.count,
      outgoingRatio: edge.count / outgoingCounts.get(edge.source)!,
      uniqueSessions: edge.sessions.size,
    }))
    .sort(
      (left, right) =>
        compareText(left.source, right.source) ||
        compareText(left.target, right.target),
    );

  return {
    nodes,
    edges,
    summary: {
      eventCount: paths.eventCount,
      sessionCount: paths.sessions.length,
      sessionsWithNodes,
      emptySessionCount,
      singleNodeSessionCount,
      nodeOccurrenceCount,
      transitionCount,
    },
  };
}

function buildPath(
  events: readonly AnalyticsEvent[],
  nodeMode: AnalyticsFlowNodeMode,
  collapseConsecutiveNodes: boolean,
): AnalyticsFlowNodeIdentity[] {
  const path: AnalyticsFlowNodeIdentity[] = [];
  for (const event of events) {
    const node = extractAnalyticsFlowNode(event, nodeMode);
    if (!node) {
      continue;
    }
    if (
      collapseConsecutiveNodes &&
      path.length > 0 &&
      path[path.length - 1].id === node.id
    ) {
      continue;
    }
    path.push(node);
  }
  return path;
}

export function extractAnalyticsFlowNode(
  event: AnalyticsEvent,
  nodeMode: AnalyticsFlowNodeMode,
): AnalyticsFlowNodeIdentity | null {
  if (nodeMode === 'screen') {
    return createScreenNode(event.screen);
  }
  if (isDomainEventType(event.eventType)) {
    return createDomainEventNode(event.eventType);
  }
  if (nodeMode === 'mixed' && event.eventType === 'screen_view') {
    return createScreenNode(event.screen);
  }
  return null;
}

function createScreenNode(screen: AnalyticsScreen): AnalyticsFlowNodeIdentity {
  return { id: `screen:${screen}`, kind: 'screen', screen };
}

function createDomainEventNode(
  eventType: AnalyticsDomainEventType,
): AnalyticsFlowNodeIdentity {
  return {
    id: `event:${eventType}`,
    kind: 'domain_event',
    eventType,
  };
}

function toFlowNode(accumulator: NodeAccumulator): AnalyticsFlowNode {
  if (accumulator.node.kind === 'screen') {
    return {
      ...accumulator.node,
      count: accumulator.count,
      uniqueSessions: accumulator.sessions.size,
    };
  }
  return {
    ...accumulator.node,
    count: accumulator.count,
    uniqueSessions: accumulator.sessions.size,
  };
}

function isDomainEventType(
  eventType: AnalyticsEvent['eventType'],
): eventType is AnalyticsDomainEventType {
  return domainEventTypes.has(eventType as AnalyticsDomainEventType);
}

export function compareAnalyticsEvents(
  left: AnalyticsEvent,
  right: AnalyticsEvent,
): number {
  return (
    Date.parse(left.timestamp) - Date.parse(right.timestamp) ||
    compareText(left.id, right.id)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateOptions(
  nodeMode: AnalyticsFlowNodeMode,
  collapseConsecutiveNodes: boolean,
): void {
  if (!['screen', 'domain_event', 'mixed'].includes(nodeMode)) {
    throw new AnalyticsFlowAggregationError(
      `Unsupported analytics flow node mode: ${String(nodeMode)}.`,
    );
  }
  if (typeof collapseConsecutiveNodes !== 'boolean') {
    throw new AnalyticsFlowAggregationError(
      'collapseConsecutiveNodes must be boolean.',
    );
  }
}
