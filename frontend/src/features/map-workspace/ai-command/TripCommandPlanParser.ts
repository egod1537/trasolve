import { tripCommandPlanSchema, type TripCommandPlan } from '@trasolve/shared';

export type TripCommandPlanParseFailure = Readonly<{
  kind: 'json_parse' | 'schema_invalid';
  timings: Readonly<{
    jsonParseMs: number;
    schemaValidationMs: number;
  }>;
}>;

export type TripCommandPlanParseTimings = Readonly<{
  jsonParseMs: number;
  schemaValidationMs: number;
}>;

export type TripCommandPlanParseResult =
  | {
      success: true;
      plan: TripCommandPlan;
      timings: TripCommandPlanParseTimings;
    }
  | { success: false; error: TripCommandPlanParseFailure };

export function parseTripCommandPlanText(
  text: string,
): TripCommandPlanParseResult {
  const document = extractSingleJsonDocument(text);
  if (!document.success) {
    return document;
  }

  let value: unknown;
  const jsonParseStartedAt = performance.now();
  try {
    value = JSON.parse(document.json) as unknown;
  } catch {
    return {
      success: false,
      error: {
        kind: 'json_parse',
        timings: {
          jsonParseMs: performance.now() - jsonParseStartedAt,
          schemaValidationMs: 0,
        },
      },
    };
  }

  const jsonParseMs = performance.now() - jsonParseStartedAt;
  const schemaValidationStartedAt = performance.now();
  const parsed = tripCommandPlanSchema.safeParse(value);
  const schemaValidationMs = performance.now() - schemaValidationStartedAt;
  if (!parsed.success) {
    return {
      success: false,
      error: {
        kind: 'schema_invalid',
        timings: { jsonParseMs, schemaValidationMs },
      },
    };
  }
  return {
    success: true,
    plan: parsed.data,
    timings: { jsonParseMs, schemaValidationMs },
  };
}

function extractSingleJsonDocument(
  text: string,
):
  | { success: true; json: string }
  | { success: false; error: TripCommandPlanParseFailure } {
  const trimmed = text.trim();
  const fenced = /^```json\s*\n?([\s\S]*?)\n?```$/i.exec(trimmed);
  if (fenced) {
    return { success: true, json: fenced[1].trim() };
  }
  if (trimmed.startsWith('```') || trimmed.endsWith('```')) {
    return {
      success: false,
      error: {
        kind: 'json_parse',
        timings: { jsonParseMs: 0, schemaValidationMs: 0 },
      },
    };
  }
  return { success: true, json: trimmed };
}
