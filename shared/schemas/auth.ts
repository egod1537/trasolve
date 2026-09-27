import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string().min(1),
  emailVerified: z.boolean(),
  name: z.string().min(1).optional(),
  pictureUrl: z.url().optional(),
});

export const authMeResponseSchema = z.object({
  user: authUserSchema.nullable(),
});
