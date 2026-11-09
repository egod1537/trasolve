import { z } from 'zod';
import { tripCommandPlanSchema, type TripCommandPlan } from '@trasolve/shared';

export const TRIP_COMMAND_PLAN_TOOL_NAME = 'propose_trip_command_plan' as const;

/**
 * The only tool the model may call. It proposes a Plan and never changes a
 * Trip: the Plan is still previewed and applied by the user in the client.
 */
export function createTripCommandPlanFunctionDeclaration() {
  const { $schema: _schema, ...parametersJsonSchema } = z.toJSONSchema(
    tripCommandPlanSchema,
    { target: 'draft-7' },
  );
  return {
    name: TRIP_COMMAND_PLAN_TOOL_NAME,
    description:
      'Propose edits to the current trip as a TripCommandPlan. The user reviews a preview before anything is applied.',
    parametersJsonSchema,
  };
}

/** Returns the Plan only when the call is this tool with schema-valid arguments. */
export function parseTripCommandPlanToolCall(call: {
  name: string;
  args?: unknown;
}): TripCommandPlan | null {
  if (call.name !== TRIP_COMMAND_PLAN_TOOL_NAME) {
    return null;
  }
  const parsed = tripCommandPlanSchema.safeParse(call.args);
  return parsed.success ? parsed.data : null;
}
