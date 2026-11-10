import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string().min(1).nullable(),
  emailVerified: z.boolean(),
  loginProvider: z.enum(['google', 'ssu', 'local']).optional(),
  name: z.string().min(1).optional(),
  pictureUrl: z.url().optional(),
});

export const authMeResponseSchema = z.object({
  user: authUserSchema.nullable(),
});
