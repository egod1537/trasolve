import type { z } from 'zod';
import type {
  placeAutocompleteRequestSchema,
  placeAutocompleteResponseSchema,
  placeAutocompleteSuggestionSchema,
  placeDetailsRequestSchema,
  placeDetailsSchema,
} from '../schemas/places.js';

export type PlaceAutocompleteRequest = z.infer<
  typeof placeAutocompleteRequestSchema
>;
export type PlaceAutocompleteSuggestion = z.infer<
  typeof placeAutocompleteSuggestionSchema
>;
export type PlaceAutocompleteResponse = z.infer<
  typeof placeAutocompleteResponseSchema
>;
export type PlaceDetailsRequest = z.infer<typeof placeDetailsRequestSchema>;
export type PlaceDetails = z.infer<typeof placeDetailsSchema>;
