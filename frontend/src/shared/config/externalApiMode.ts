export type FrontendExternalApiMode = 'enabled' | 'disabled';

export const frontendExternalApiMode = parseFrontendExternalApiMode(
  import.meta.env.VITE_EXTERNAL_API_MODE,
);

function parseFrontendExternalApiMode(
  value: string | undefined,
): FrontendExternalApiMode {
  const mode = value?.trim() || 'enabled';
  if (mode === 'enabled' || mode === 'disabled') {
    return mode;
  }
  throw new Error('VITE_EXTERNAL_API_MODE must be enabled or disabled.');
}
