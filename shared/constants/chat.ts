export const CHAT_LIMITS = {
  messageLength: 4000,
  messages: 100,
  bodyBytes: 2 * 1024 * 1024,
  webImages: 4,
  toolProgress: 16,
} as const;

export const CHAT_TOOL_PROGRESS_ACCEPT =
  'text/event-stream; profile="trasolve-tool-progress"';
