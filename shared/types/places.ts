import type { z } from 'zod';
import type {
  placeAutocompleteRequestSchema,
  placeAutocompleteResponseSchema,
  placeAutocompleteSuggestionSchema,
  placeDetailsRequestSchema,
  placeDetailsSchema,
  placeOpeningHoursPeriodSchema,
  placeOpeningHoursPointSchema,
  placeOpeningHoursSchema,
  placeOpeningScheduleSchema,
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
export type PlaceOpeningHoursPoint = z.infer<
  typeof placeOpeningHoursPointSchema
>;
export type PlaceOpeningHoursPeriod = z.infer<
  typeof placeOpeningHoursPeriodSchema
>;
export type PlaceOpeningSchedule = z.infer<typeof placeOpeningScheduleSchema>;
export type PlaceOpeningHours = z.infer<typeof placeOpeningHoursSchema>;
