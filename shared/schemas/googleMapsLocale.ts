import { z } from 'zod';
import { GOOGLE_MAPS_LANGUAGE_CODES } from '../constants/googleMapsLocale.js';

export const googleMapsLanguageCodeSchema = z.enum(GOOGLE_MAPS_LANGUAGE_CODES);

export const googleMapsRegionCodeSchema = z.string().regex(/^[A-Z]{2}$/u);
