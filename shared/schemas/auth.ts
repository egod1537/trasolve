import { z } from 'zod';
import { googleOAuthUserSchema } from './googleOAuth.js';

export const authMeResponseSchema = z.object({
  user: googleOAuthUserSchema.nullable(),
});
