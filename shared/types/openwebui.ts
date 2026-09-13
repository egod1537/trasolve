import type { z } from 'zod';
import type {
  openWebUIModelListResponseSchema,
  openWebUIModelSchema,
} from '../schemas/openwebui.js';

export type OpenWebUIModel = z.infer<typeof openWebUIModelSchema>;
export type OpenWebUIModelListResponse = z.infer<
  typeof openWebUIModelListResponseSchema
>;
