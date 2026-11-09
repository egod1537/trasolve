export const externalApiServices = [
  'google-places',
  'google-routes',
  'google-oauth',
  'gemini',
  'openwebui',
  'troute',
  'tcache',
] as const;

export type ExternalApiService = (typeof externalApiServices)[number];
export type ExternalApiMode = 'enabled' | 'disabled' | 'mock';

export class ExternalApiPolicyError extends Error {
  public constructor(
    public readonly code:
      'EXTERNAL_API_DISABLED' | 'EXTERNAL_API_MOCK_NOT_IMPLEMENTED',
    public readonly service: ExternalApiService,
    public readonly operation: string,
  ) {
    super(
      code === 'EXTERNAL_API_DISABLED'
        ? `External API access is disabled for ${service}.`
        : `No external API mock is implemented for ${service}:${operation}.`,
    );
    this.name = 'ExternalApiPolicyError';
  }
}

export class ExternalApiPolicy {
  public constructor(public readonly mode: ExternalApiMode) {}

  public resolve(
    service: ExternalApiService,
    operation: string,
  ): 'enabled' | 'mock' {
    if (this.mode === 'enabled') {
      return 'enabled';
    }
    if (this.mode === 'mock') {
      return 'mock';
    }
    throw this.blocked('EXTERNAL_API_DISABLED', service, operation);
  }

  public assertNetworkAllowed(
    service: ExternalApiService,
    operation: string,
  ): void {
    if (this.mode === 'enabled') {
      return;
    }
    throw this.blocked(
      this.mode === 'disabled'
        ? 'EXTERNAL_API_DISABLED'
        : 'EXTERNAL_API_MOCK_NOT_IMPLEMENTED',
      service,
      operation,
    );
  }

  private blocked(
    code: 'EXTERNAL_API_DISABLED' | 'EXTERNAL_API_MOCK_NOT_IMPLEMENTED',
    service: ExternalApiService,
    operation: string,
  ): ExternalApiPolicyError {
    console.warn(
      JSON.stringify({
        event: 'external_api_blocked',
        mode: this.mode,
        service,
        operation,
        code,
      }),
    );
    return new ExternalApiPolicyError(code, service, operation);
  }
}

let configuredPolicy: ExternalApiPolicy | undefined;

export function loadExternalApiPolicy(
  environment: NodeJS.ProcessEnv = process.env,
): ExternalApiPolicy {
  configuredPolicy ??= parseExternalApiPolicy(environment);
  return configuredPolicy;
}

function parseExternalApiPolicy(
  environment: NodeJS.ProcessEnv,
): ExternalApiPolicy {
  const rawMode = environment.TRASOLVE_EXTERNAL_API_MODE?.trim() || 'enabled';
  if (rawMode !== 'enabled' && rawMode !== 'disabled' && rawMode !== 'mock') {
    throw new Error(
      'TRASOLVE_EXTERNAL_API_MODE must be enabled, disabled, or mock.',
    );
  }
  if (
    rawMode === 'mock' &&
    environment.NODE_ENV === 'production' &&
    environment.TRASOLVE_EXTERNAL_API_MOCK_ALLOW_PRODUCTION !== 'true'
  ) {
    throw new Error(
      'TRASOLVE_EXTERNAL_API_MODE=mock in production requires TRASOLVE_EXTERNAL_API_MOCK_ALLOW_PRODUCTION=true.',
    );
  }
  const mockProductionOverride =
    environment.TRASOLVE_EXTERNAL_API_MOCK_ALLOW_PRODUCTION;
  if (
    mockProductionOverride !== undefined &&
    mockProductionOverride !== '' &&
    mockProductionOverride !== 'true' &&
    mockProductionOverride !== 'false'
  ) {
    throw new Error(
      'TRASOLVE_EXTERNAL_API_MOCK_ALLOW_PRODUCTION must be true or false.',
    );
  }
  return new ExternalApiPolicy(rawMode);
}
