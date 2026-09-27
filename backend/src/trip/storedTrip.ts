import { isDeepStrictEqual } from 'node:util';
import { tripSchema, type Trip } from '@trasolve/shared';
import { z } from 'zod';

export const currentTripSchemaVersion = 1;

export interface StoredTripV1 {
  readonly days: Trip['days'];
}

const storedTripV1ObjectSchema = z
  .strictObject({
    days: z.array(z.unknown()),
  })
  .superRefine((document, context) => {
    const result = tripSchema.safeParse({
      id: 'stored-trip-validation',
      userId: 'stored-user-validation',
      title: 'Stored trip validation',
      days: document.days,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
    });
    if (
      !result.success ||
      !isDeepStrictEqual(result.data.days, document.days)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'StoredTripV1 must contain current, fully normalized days.',
      });
    }
  });

export function parseStoredTripV1(value: unknown): StoredTripV1 {
  const document = storedTripV1ObjectSchema.parse(value);
  return { days: document.days as Trip['days'] };
}

export function createStoredTripV1(trip: Trip): StoredTripV1 {
  const currentTrip = tripSchema.parse(trip);
  return parseStoredTripV1({ days: currentTrip.days });
}
