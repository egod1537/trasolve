import type { z } from 'zod';
import type { authMeResponseSchema } from '../schemas/auth.js';

export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
