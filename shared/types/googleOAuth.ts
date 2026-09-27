import type { z } from 'zod';
import type {
  googleOAuthProfileSchema,
  googleOAuthResultSchema,
} from '../schemas/googleOAuth.js';

export type GoogleOAuthProfile = z.infer<typeof googleOAuthProfileSchema>;
export type GoogleOAuthResult = z.infer<typeof googleOAuthResultSchema>;
