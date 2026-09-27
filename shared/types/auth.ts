import type { z } from 'zod';
import type { authMeResponseSchema, authUserSchema } from '../schemas/auth.js';

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthMeResponse = z.infer<typeof authMeResponseSchema>;
