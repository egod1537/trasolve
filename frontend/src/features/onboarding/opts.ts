import {
  preferenceRepository,
  USER_PREFERENCE_KEYS,
} from '@/shared/preferences/preferenceRepository';
import { opts, type TutorialMode } from '@/shared/config/opts';

export type { TutorialMode } from '@/shared/config/opts';

export function resolveTutorialMode(debug: boolean): TutorialMode {
  if (!debug) {
    return 'auto';
  }
  const query = new URLSearchParams(window.location.search).get('tutorial');
  const value =
    query ??
    preferenceRepository.read(USER_PREFERENCE_KEYS.tutorialMode) ??
    opts.tutorialMode;
  return value === 'always' || value === 'off' ? value : 'auto';
}

export function saveTutorialMode(mode: TutorialMode): void {
  preferenceRepository.write(USER_PREFERENCE_KEYS.tutorialMode, mode);
  const url = new URL(window.location.href);
  url.searchParams.delete('tutorial');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}
