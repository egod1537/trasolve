import { z } from 'zod';

export const openWebUIModelSchema = z.strictObject({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
});

export const openWebUIModelListResponseSchema = z.strictObject({
  models: z.array(openWebUIModelSchema),
});
