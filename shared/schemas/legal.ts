import { z } from 'zod';

export const LEGAL_VERSIONS = {
  terms: '2026-11-12',
  privacy: '2026-11-12',
} as const;

export const LEGAL_PATHS = {
  consent: '/auth/consent',
  terms: '/legal/terms',
  privacy: '/legal/privacy',
} as const;

export const authConsentAcceptanceSchema = z.strictObject({
  termsVersion: z.string().min(1).max(40),
  privacyVersion: z.string().min(1).max(40),
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  ageConfirmed: z.literal(true),
  profileAccepted: z.boolean(),
});

export const authConsentRecordSchema = authConsentAcceptanceSchema.extend({
  acceptedAt: z.iso.datetime(),
});

export const authConsentStatusSchema = z.object({
  status: z.enum(['required', 'accepted', 'signed-out']),
  provider: z.enum(['google', 'ssu', 'local']).nullable(),
  versions: z.object({ terms: z.string(), privacy: z.string() }),
  acceptance: authConsentRecordSchema.nullable(),
  returnTo: z.string(),
  operatorName: z.string().nullable(),
  contactEmail: z.email().nullable(),
  contactUrl: z.url(),
});

export type AuthConsentAcceptance = z.infer<typeof authConsentAcceptanceSchema>;
export type AuthConsentRecord = z.infer<typeof authConsentRecordSchema>;
export type AuthConsentStatus = z.infer<typeof authConsentStatusSchema>;
