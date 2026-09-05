import type { z } from 'zod';
import type { healthResponseSchema } from '../schemas/index.js';

export type HealthResponse = z.infer<typeof healthResponseSchema>;
