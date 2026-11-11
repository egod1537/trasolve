import { z } from 'zod';

export const TUTORIAL_VERSION = 2;
export const TUTORIAL_STEPS = [
  'create',
  'days',
  'search',
  'add-place',
  'optimize',
  'ai',
] as const;
export const tutorialProgressSchema = z
  .strictObject({
    version: z.number().int().positive(),
    status: z.enum(['not-started', 'in-progress', 'completed', 'skipped']),
    // Keep version-one records readable so the provider can restart the new flow.
    step: z.enum([...TUTORIAL_STEPS, 'share']),
    tripId: z.uuid().nullable(),
  })
  .refine(
    (progress) =>
      progress.version !== TUTORIAL_VERSION || progress.step !== 'share',
  );
export type TutorialProgress = z.infer<typeof tutorialProgressSchema>;

export function initialTutorialProgress(): TutorialProgress {
  return {
    version: TUTORIAL_VERSION,
    status: 'not-started',
    step: 'create',
    tripId: null,
  };
}
