import {
  API_ROUTES,
  tutorialProgressSchema,
  type TutorialProgress,
} from '@trasolve/shared';

export async function readTutorial(
  userId: string,
  signal: AbortSignal,
): Promise<TutorialProgress> {
  const response = await fetch(API_ROUTES.tutorial, {
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', 'X-Trasolve-Tutorial-User': userId },
  });
  if (!response.ok) {
    throw new Error('Tutorial progress could not be loaded.');
  }
  return tutorialProgressSchema.parse(await response.json());
}

export async function writeTutorial(
  userId: string,
  progress: TutorialProgress,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(API_ROUTES.tutorial, {
    method: 'PUT',
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'X-Trasolve-Tutorial': '1',
      'X-Trasolve-Tutorial-User': userId,
    },
    body: JSON.stringify(progress),
  });
  if (!response.ok) {
    throw new Error('Tutorial progress could not be saved.');
  }
}
