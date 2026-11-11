export const OPENWEBUI_OPTIONS = {
  defaultModel: 'gpt-6.1-sol',
  modelsTimeoutMs: 15_000,
  chatTimeoutMs: 120_000,
} as const;

export const BILLING_OPTIONS = {
  unlimitedTokensInDebug: true,
} as const;
