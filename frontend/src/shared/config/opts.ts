export type TutorialMode = 'auto' | 'always' | 'off';
const tutorialMode = import.meta.env.VITE_TUTORIAL_MODE;

/** Restart/rebuild after changing defaults. Tutorial overrides are debug-only. */
export const opts = {
  useChatV2: import.meta.env.VITE_USE_CHAT_V2 !== 'false',
  tutorialMode: (tutorialMode === 'always' || tutorialMode === 'off'
    ? tutorialMode
    : 'auto') as TutorialMode,
} as const;
