import { z } from 'zod';

export const googleOAuthUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  emailVerified: z.boolean(),
  name: z.string().min(1).optional(),
  pictureUrl: z.url().optional(),
});

export const googleOAuthResultSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    user: googleOAuthUserSchema,
  }),
  z.object({
    status: z.literal('error'),
    error: z.enum([
      'access_denied',
      'provider_error',
      'invalid_callback',
      'token_exchange_failed',
      'userinfo_request_failed',
    ]),
  }),
  z.object({ status: z.literal('missing') }),
  z.object({ status: z.literal('unavailable') }),
]);
