import { CHAT_LIMITS } from '@trasolve/shared';
import {
  TRIP_COMMAND_PLAN_SYSTEM_PROMPT,
  createTripCommandPlanSystemPrompt,
  type TripCommandPlanContext,
} from '@/features/map-workspace/ai-command/TripCommandPlanContext';

type ContextSection = 'days' | 'places' | 'polylines' | 'selection';

type ContextPiece =
  | Readonly<{ section: 'trip'; value: object }>
  | Readonly<{ section: ContextSection; value: object }>;

type ContextPart = Partial<Record<ContextSection, object[]> & { trip: object }>;

// Worst-case prefix width ("99/99"), so the part count can be filled in after
// packing without any part growing past the message limit.
const RESERVED_PART_LABEL = 'Trip context part 99/99\n';

/**
 * System messages that carry the instructions and the full trip context.
 *
 * The existing single message (the original form, or its id-indexed compact
 * form when the original is too long) is used whenever it fits, so every trip
 * that works today produces exactly the same message. Only when even the
 * compact form exceeds one message, the context is split into several system
 * messages, each within the shared message limit. Nothing is truncated or
 * dropped: if a single row cannot fit in a message by itself, `null` is
 * returned and the caller must refuse to send instead of sending less.
 */
export function createTripCommandPlanSystemMessages(
  context: TripCommandPlanContext,
): string[] | null {
  const single = createTripCommandPlanSystemPrompt(context);
  if (single.length <= CHAT_LIMITS.messageLength) {
    return [single];
  }

  const parts = packContextParts(context);
  if (!parts) {
    return null;
  }
  const total = parts.length;
  // One instruction message plus the parts, leaving room for at least one
  // conversation message in the same request.
  if (1 + total > CHAT_LIMITS.messages - 1) {
    return null;
  }
  const instructions = `${TRIP_COMMAND_PLAN_SYSTEM_PROMPT}\nCurrent tripContext is split into ${total} following system messages labelled "Trip context part i/${total}". Each is a JSON object holding some of: trip, days, places, polylines, selection (a missing section has no rows). Together they are one tripContext. Rows keep their exact inline id strings; plans must use those exact ID strings.`;
  const messages = [
    instructions,
    ...parts.map(
      (part, index) =>
        `Trip context part ${index + 1}/${total}\n${JSON.stringify(part)}`,
    ),
  ];
  return messages.every(
    (message) => message.length <= CHAT_LIMITS.messageLength,
  )
    ? messages
    : null;
}

function listPieces(context: TripCommandPlanContext): ContextPiece[] {
  return [
    { section: 'trip', value: context.trip },
    ...context.days.map((value) => ({ section: 'days' as const, value })),
    ...context.places.map((value) => ({ section: 'places' as const, value })),
    ...context.polylines.map((value) => ({
      section: 'polylines' as const,
      value,
    })),
    ...context.selection.map((value) => ({
      section: 'selection' as const,
      value,
    })),
  ];
}

function withPiece(part: ContextPart, piece: ContextPiece): ContextPart {
  return piece.section === 'trip'
    ? { ...part, trip: piece.value }
    : {
        ...part,
        [piece.section]: [...(part[piece.section] ?? []), piece.value],
      };
}

function fits(part: ContextPart): boolean {
  return (
    RESERVED_PART_LABEL.length + JSON.stringify(part).length <=
    CHAT_LIMITS.messageLength
  );
}

/** Greedy, order-preserving packing of whole rows. Returns null if a row alone is too large. */
function packContextParts(
  context: TripCommandPlanContext,
): ContextPart[] | null {
  const parts: ContextPart[] = [];
  let current: ContextPart = {};
  let currentCount = 0;
  for (const piece of listPieces(context)) {
    const candidate = withPiece(current, piece);
    if (fits(candidate)) {
      current = candidate;
      currentCount += 1;
      continue;
    }
    if (currentCount > 0) {
      parts.push(current);
    }
    current = withPiece({}, piece);
    currentCount = 1;
    if (!fits(current)) {
      return null;
    }
  }
  if (currentCount > 0) {
    parts.push(current);
  }
  return parts;
}
