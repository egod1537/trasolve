import { z } from 'zod';

const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const routeLocationSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('place'),
    placeId: z.string().trim().min(1).max(512),
  }),
  z.strictObject({
    type: z.literal('coordinates'),
    ...coordinatesSchema.shape,
  }),
  z.strictObject({
    type: z.literal('address'),
    address: z.string().trim().min(1).max(1024),
  }),
]);

export const directionsRequestSchema = z
  .strictObject({
    origin: routeLocationSchema,
    destination: routeLocationSchema,
    travelMode: z
      .enum(['DRIVING', 'WALKING', 'BICYCLING', 'TRANSIT'])
      .optional(),
    intermediates: z.array(routeLocationSchema).max(25).optional(),
    computeAlternativeRoutes: z.boolean().optional(),
  })
  .refine(
    (request) =>
      request.travelMode !== 'TRANSIT' || !request.intermediates?.length,
    {
      message: '대중교통 경로에는 경유지를 지정할 수 없습니다.',
      path: ['intermediates'],
    },
  );

export const mapRouteSchema = z.object({
  description: z.string(),
  distanceMeters: z.number().nonnegative().nullable(),
  durationMillis: z.number().nonnegative().nullable(),
  path: z.array(coordinatesSchema),
  bounds: z
    .object({
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    })
    .nullable(),
  warnings: z.array(z.string()),
});

export const directionsResultSchema = z.object({
  request: directionsRequestSchema,
  routes: z.array(mapRouteSchema),
  /** Google REST response for the development inspector. */
  rawResponse: z.unknown(),
});

export const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
