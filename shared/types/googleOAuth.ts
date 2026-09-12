import type { z } from 'zod';
import type {
  googleOAuthResultSchema,
  googleOAuthUserSchema,
} from '../schemas/googleOAuth.js';

export type GoogleOAuthUser = z.infer<typeof googleOAuthUserSchema>;
export type GoogleOAuthResult = z.infer<typeof googleOAuthResultSchema>;
