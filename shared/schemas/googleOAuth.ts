import { z } from 'zod';
import { authUserSchema } from './auth.js';

export const googleOAuthProfileSchema = z.object({
  subject: z.string().min(1),
  email: z.string().min(1),
  emailVerified: z.boolean(),
  name: z.string().min(1).optional(),
  pictureUrl: z.url().optional(),
});

export const googleOAuthResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    provider: z.enum(['google', 'ssu']).optional(),
    user: authUserSchema,
  }),
  z.object({
    status: z.literal('error'),
    provider: z.enum(['google', 'ssu']).optional(),
    error: z.enum([
      'access_denied',
      'provider_error',
      'invalid_callback',
      'token_exchange_failed',
      'userinfo_request_failed',
    ]),
  }),
  z.object({
    provider: z.enum(['google', 'ssu']).optional(),
    status: z.literal('missing'),
  }),
  z.object({
    provider: z.enum(['google', 'ssu']).optional(),
    status: z.literal('disabled'),
  }),
  z.object({
    provider: z.enum(['google', 'ssu']).optional(),
    status: z.literal('unavailable'),
  }),
]);
