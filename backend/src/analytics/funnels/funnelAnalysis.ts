import {
  analyticsEventSchema,
  funnelAggregationFiltersSchema,
  funnelDefinitionSchema,
  type AnalyticsEvent,
  type FunnelAggregationFilters,
  type FunnelDefinition,
  type FunnelMatchedStep,
  type FunnelProgressionResult,
  type FunnelResult,
  type FunnelSessionProgression,
  type FunnelStep,
  type FunnelStepCondition,
} from '@trasolve/shared';
import { compareAnalyticsEvents } from '../flowAggregation.js';

type CollectedFunnelInput = {
  readonly definition: FunnelDefinition;
  readonly sessions: readonly FunnelSessionProgression[];
};

export class FunnelAnalysisError extends Error {
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FunnelAnalysisError';
  }
}

export async function analyzeFunnel(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  definitionInput: FunnelDefinition,
  filtersInput: FunnelAggregationFilters = {},
): Promise<FunnelResult> {
  const collected = await collectFunnelInput(
    eventInput,
    definitionInput,
    filtersInput,
  );
  const stepSessions = collected.definition.steps.map(() => 0);
  const transitionDurations = collected.definition.steps.map(
    () => [] as number[],
  );
  const completionDurations: number[] = [];

  for (const session of collected.sessions) {
    for (
      let stepIndex = 0;
      stepIndex < session.matchedSteps.length;
      stepIndex += 1
    ) {
      stepSessions[stepIndex] += 1;
      if (stepIndex > 0) {
        transitionDurations[stepIndex].push(
          Date.parse(session.matchedSteps[stepIndex].timestamp) -
            Date.parse(session.matchedSteps[stepIndex - 1].timestamp),
        );
      }
    }
    if (session.completed) {
      completionDurations.push(
        Date.parse(session.matchedSteps.at(-1)!.timestamp) -
          Date.parse(session.matchedSteps[0].timestamp),
      );
    }
  }

  const firstStepSessions = stepSessions[0];
  return {
    funnelId: collected.definition.id,
    totalSessions: collected.sessions.length,
    averageCompletionTimeMs:
      completionDurations.length === 0 ? null : average(completionDurations),
    attribution: null,
    steps: collected.definition.steps.map((step, stepIndex) => {
      const enteredSessions = stepSessions[stepIndex];
      const nextStepSessions = stepSessions[stepIndex + 1] ?? enteredSessions;
      const dropOffSessions = enteredSessions - nextStepSessions;
      const durations = transitionDurations[stepIndex];
      return {
        stepId: step.id,
        enteredSessions,
        conversionFromPrevious:
          stepIndex === 0
            ? null
            : ratio(enteredSessions, stepSessions[stepIndex - 1]),
        overallConversion: ratio(enteredSessions, firstStepSessions),
        dropOffSessions,
        dropOffRate: ratio(dropOffSessions, enteredSessions),
        averageTimeFromPreviousMs:
          stepIndex === 0 || durations.length === 0 ? null : average(durations),
        medianTimeFromPreviousMs:
          stepIndex === 0 || durations.length === 0 ? null : median(durations),
      };
    }),
  };
}

export async function buildFunnelSessionProgressions(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  definitionInput: FunnelDefinition,
  filtersInput: FunnelAggregationFilters = {},
): Promise<FunnelProgressionResult> {
  const collected = await collectFunnelInput(
    eventInput,
    definitionInput,
    filtersInput,
  );
  return {
    funnelId: collected.definition.id,
    totalSessions: collected.sessions.length,
    sessions: collected.sessions,
  };
}

export function matchesFunnelStep(
  event: AnalyticsEvent,
  step: FunnelStep,
): boolean {
  if (step.alternatives !== undefined) {
    return step.alternatives.some((condition) =>
      matchesFunnelCondition(event, condition),
    );
  }
  return matchesFunnelCondition(event, step);
}

async function collectFunnelInput(
  eventInput: Iterable<AnalyticsEvent> | AsyncIterable<AnalyticsEvent>,
  definitionInput: FunnelDefinition,
  filtersInput: FunnelAggregationFilters,
): Promise<CollectedFunnelInput> {
  const parsedDefinition = funnelDefinitionSchema.safeParse(definitionInput);
  if (!parsedDefinition.success) {
    throw new FunnelAnalysisError('Funnel definition is invalid.', {
      cause: parsedDefinition.error,
    });
  }
  const parsedFilters = funnelAggregationFiltersSchema.safeParse(filtersInput);
  if (!parsedFilters.success) {
    throw new FunnelAnalysisError('Funnel filters are invalid.', {
      cause: parsedFilters.error,
    });
  }

  const groupedEvents = new Map<string, AnalyticsEvent[]>();
  let eventIndex = 0;
  for await (const eventInputValue of eventInput) {
    const parsedEvent = analyticsEventSchema.safeParse(eventInputValue);
    if (!parsedEvent.success) {
      throw new FunnelAnalysisError(
        `Funnel input event at index ${eventIndex} is invalid.`,
        { cause: parsedEvent.error },
      );
    }
    eventIndex += 1;
    if (!matchesEventFilters(parsedEvent.data, parsedFilters.data)) {
      continue;
    }
    const sessionEvents = groupedEvents.get(parsedEvent.data.sessionId) ?? [];
    sessionEvents.push(parsedEvent.data);
    groupedEvents.set(parsedEvent.data.sessionId, sessionEvents);
  }

  const sessions = Array.from(groupedEvents.entries())
    .filter(([, events]) =>
      matchesAuthenticationFilter(events, parsedFilters.data.authenticated),
    )
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([sessionId, events]) => {
      events.sort(compareAnalyticsEvents);
      const matchedSteps = matchOrderedSteps(
        events,
        parsedDefinition.data.steps,
      );
      return {
        sessionId,
        matchedSteps,
        completed: matchedSteps.length === parsedDefinition.data.steps.length,
      };
    });

  return { definition: parsedDefinition.data, sessions };
}

function matchesEventFilters(
  event: AnalyticsEvent,
  filters: FunnelAggregationFilters,
): boolean {
  const timestamp = Date.parse(event.timestamp);
  if (filters.from !== undefined && timestamp < Date.parse(filters.from)) {
    return false;
  }
  if (filters.to !== undefined && timestamp > Date.parse(filters.to)) {
    return false;
  }
  return (
    filters.locale === undefined || event.metadata?.locale === filters.locale
  );
}

function matchesAuthenticationFilter(
  events: readonly AnalyticsEvent[],
  authenticated: boolean | undefined,
): boolean {
  if (authenticated === undefined) {
    return true;
  }
  const hasAuthenticatedEvent = events.some((event) => event.userId !== null);
  return authenticated ? hasAuthenticatedEvent : !hasAuthenticatedEvent;
}

function matchesFunnelCondition(
  event: AnalyticsEvent,
  condition: FunnelStepCondition,
): boolean {
  if (
    condition.eventType !== undefined &&
    event.eventType !== condition.eventType
  ) {
    return false;
  }
  if (condition.screen !== undefined && event.screen !== condition.screen) {
    return false;
  }
  if (condition.target !== undefined && event.target !== condition.target) {
    return false;
  }
  if (condition.metadata !== undefined) {
    if (event.metadata === null) {
      return false;
    }
    const eventMetadata = event.metadata as Record<string, unknown>;
    for (const [key, value] of Object.entries(condition.metadata)) {
      if (eventMetadata[key] !== value) {
        return false;
      }
    }
  }
  return true;
}

function matchOrderedSteps(
  events: readonly AnalyticsEvent[],
  steps: readonly FunnelStep[],
): FunnelMatchedStep[] {
  const matchedSteps: FunnelMatchedStep[] = [];
  let eventIndex = 0;

  for (const step of steps) {
    while (
      eventIndex < events.length &&
      !matchesFunnelStep(events[eventIndex], step)
    ) {
      eventIndex += 1;
    }
    if (eventIndex === events.length) {
      break;
    }
    matchedSteps.push({
      stepId: step.id,
      eventId: events[eventIndex].id,
      timestamp: events[eventIndex].timestamp,
    });
    eventIndex += 1;
  }
  return matchedSteps;
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
