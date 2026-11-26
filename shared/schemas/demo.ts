import { z } from 'zod';
import { authUserSchema } from './auth.js';

export const demoStatusSchema = z.strictObject({
  available: z.boolean(),
  active: z.boolean(),
  hasPreviousActivity: z.boolean(),
  exampleTripId: z.string().nullable(),
});

export const demoEnterResponseSchema = z.strictObject({
  user: authUserSchema,
  status: demoStatusSchema,
});

export type DemoStatus = z.infer<typeof demoStatusSchema>;
export type DemoEnterResponse = z.infer<typeof demoEnterResponseSchema>;
