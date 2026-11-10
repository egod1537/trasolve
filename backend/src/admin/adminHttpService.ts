import { ssuCallbackUrl } from '../ssuSso.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  API_ROUTES,
  adminReasonCodeSchema,
  externalApiServiceSchema,
  type ApiErrorResponse,
} from '@trasolve/shared';
import { z } from 'zod';
import type { AdminAuthorizationService } from './adminAuthorizationService.js';
import {
  AdminAuthenticationRequiredError,
  AdminForbiddenError,
  AdminRequiresPostgresError,
  AdminUnavailableError,
} from './adminAuthorizationService.js';
import type { AdminCsrfService } from './adminCsrfService.js';
import {
  AdminCsrfConfigurationError,
  AdminCsrfValidationError,
} from './adminCsrfService.js';
import type {
  AdminAuditInput,
  AdminPageCursor,
  AdminRepository,
  AdminUsageInput,
} from './adminRepository.js';
import { AdminActorNoLongerAuthorizedError } from './postgresAdminRepository.js';
import type { TrouteJobRepository } from '../internal/troute/trouteJobRepository.js';

const uuidSchema = z.uuid();
const tripIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const actionSchema = z.enum(['suspend', 'restore', 'revoke-sessions']);
const maximumBodyBytes = 4096;
const maximumRangeMs = 90 * 24 * 60 * 60 * 1_000;
const defaultUsageRangeMs = 7 * 24 * 60 * 60 * 1_000;

class AdminHttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly allow?: string,
  ) {
    super(message);
    this.name = 'AdminHttpError';
  }
}

export class AdminHttpService {
  public constructor(
    private readonly authorization: AdminAuthorizationService,
    private readonly repository: AdminRepository | null,
    private readonly csrf: AdminCsrfService,
    private readonly trouteJobs: Pick<
      TrouteJobRepository,
      'listRecentOperationalMetadata'
    > | null,
  ) {}

  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    requestUrl: URL,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const actor = await this.authorization.authorize(request);
      const path = requestUrl.pathname;

      if (path === API_ROUTES.adminMe) {
        this.requireMethod(request, 'GET');
        sendJson(response, 200, {
          user: {
            id: actor.id,
            ...(actor.displayName ? { name: actor.displayName } : {}),
            email: actor.email,
          },
          role: 'admin',
          csrfToken: this.csrf.issue(request),
        });
        return;
      }

      const repository = this.requireRepository();

      if (path === API_ROUTES.adminSummary) {
        this.requireMethod(request, 'GET');
        sendJson(response, 200, await repository.getSummary());
        return;
      }

      if (path === API_ROUTES.adminUsers) {
        this.requireMethod(request, 'GET');
        sendJson(
          response,
          200,
          await repository.listUsers(readUserFilters(requestUrl)),
        );
        return;
      }

      const userRoute = matchUserRoute(path);
      if (userRoute) {
        if (!userRoute.action) {
          this.requireMethod(request, 'GET');
          const detail = await repository.getUserDetail(userRoute.userId);
          if (!detail) {
            throw notFound();
          }
          sendJson(response, 200, detail);
          return;
        }
        this.requireMethod(request, 'POST');
        if (actor.id === userRoute.userId) {
          throw new AdminHttpError(
            409,
            'ADMIN_SELF_ACTION_FORBIDDEN',
            'An administrator cannot apply this action to the current session owner.',
          );
        }
        this.rateLimiter.consume(actor.id);
        this.csrf.validate(
          request,
          readSingleHeader(request, 'x-trasolve-csrf'),
        );
        const body = await readJson(request);
        const reasonCode = parseActionBody(userRoute.action, body);
        const result = await repository.mutateUser(
          actor.id,
          userRoute.userId,
          userRoute.action,
          reasonCode,
        );
        if (!result) {
          throw notFound();
        }
        sendJson(response, 200, result);
        return;
      }

      if (path === API_ROUTES.adminTrips) {
        this.requireMethod(request, 'GET');
        sendJson(
          response,
          200,
          await repository.listTrips(readTripFilters(requestUrl)),
        );
        return;
      }

      const tripId = matchTripMetadataRoute(path);
      if (tripId) {
        this.requireMethod(request, 'GET');
        const trip = await repository.getTripMetadata(tripId);
        if (!trip) {
          throw notFound();
        }
        sendJson(response, 200, { trip });
        return;
      }

      if (path === API_ROUTES.adminApiUsageSummary) {
        this.requireMethod(request, 'GET');
        sendJson(
          response,
          200,
          await repository.getUsageSummary(readUsageFilters(requestUrl)),
        );
        return;
      }

      if (path === API_ROUTES.adminOperationsSummary) {
        this.requireMethod(request, 'GET');
        const to = new Date();
        const from = new Date(to.valueOf() - 24 * 60 * 60 * 1_000);
        sendJson(
          response,
          200,
          completeOperationsSummary(
            await repository.getOperationsSummary(from, to),
            this.trouteJobs,
          ),
        );
        return;
      }

      if (path === API_ROUTES.adminAudit) {
        this.requireMethod(request, 'GET');
        sendJson(
          response,
          200,
          await repository.listAudit(readAuditFilters(requestUrl)),
        );
        return;
      }

      throw notFound();
    } catch (cause) {
      sendAdminError(response, cause);
    }
  }

  private readonly rateLimiter = new AdminMutationRateLimiter();

  private requireRepository(): AdminRepository {
    if (!this.repository) {
      throw new AdminRequiresPostgresError();
    }
    return this.repository;
  }

  private requireMethod(
    request: IncomingMessage,
    method: 'GET' | 'POST',
  ): void {
    if (request.method !== method) {
      throw new AdminHttpError(
        405,
        'METHOD_NOT_ALLOWED',
        `This resource requires ${method}.`,
        method,
      );
    }
  }
}

class AdminMutationRateLimiter {
  public consume(userId: string): void {
    const now = Date.now();
    this.prune(now);
    const record = this.records.get(userId);
    if (!record || record.resetAt <= now) {
      this.records.set(userId, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (record.count >= 20) {
      throw new AdminHttpError(
        429,
        'ADMIN_RATE_LIMITED',
        'Too many administrator mutations were requested.',
      );
    }
    record.count += 1;
  }

  private readonly records = new Map<
    string,
    { count: number; resetAt: number }
  >();

  private prune(now: number): void {
    for (const [key, record] of this.records) {
      if (record.resetAt <= now || this.records.size > 1000) {
        this.records.delete(key);
      }
    }
  }
}

function readUserFilters(requestUrl: URL) {
  const query = readQuery(requestUrl, 'query');
  return {
    query,
    role: readEnum(requestUrl, 'role', ['user', 'admin'] as const),
    state: readEnum(requestUrl, 'state', ['active', 'suspended'] as const),
    limit: readLimit(requestUrl),
    cursor: readCursor(requestUrl, uuidSchema),
  };
}

function readTripFilters(requestUrl: URL) {
  const ownerValue = requestUrl.searchParams.get('ownerUserId');
  const ownerUserId = ownerValue
    ? parseValue(ownerValue, uuidSchema, 'ownerUserId')
    : null;
  const sharedValue = requestUrl.searchParams.get('shared');
  if (
    sharedValue !== null &&
    sharedValue !== 'true' &&
    sharedValue !== 'false'
  ) {
    throw invalidRequest('shared must be true or false.');
  }
  return {
    query: readQuery(requestUrl, 'query'),
    ownerUserId,
    shared: sharedValue === null ? null : sharedValue === 'true',
    limit: readLimit(requestUrl),
    cursor: readCursor(requestUrl, tripIdSchema),
  };
}

function readUsageFilters(requestUrl: URL): AdminUsageInput {
  const now = new Date();
  const to = readDate(requestUrl, 'to') ?? now;
  const from =
    readDate(requestUrl, 'from') ??
    new Date(to.valueOf() - defaultUsageRangeMs);
  validateRange(from, to);
  const serviceValue = requestUrl.searchParams.get('service');
  const actorValue =
    requestUrl.searchParams.get('actorUserId') ??
    requestUrl.searchParams.get('userId');
  const bucketValue = requestUrl.searchParams.get('bucket') ?? 'day';
  if (bucketValue !== 'hour' && bucketValue !== 'day') {
    throw invalidRequest('bucket must be hour or day.');
  }
  return {
    from,
    to,
    service: serviceValue
      ? parseValue(serviceValue, externalApiServiceSchema, 'service')
      : null,
    actorUserId: actorValue
      ? parseValue(actorValue, uuidSchema, 'actorUserId')
      : null,
    bucket: bucketValue as 'hour' | 'day',
  };
}

function readAuditFilters(requestUrl: URL): AdminAuditInput {
  const from = readDate(requestUrl, 'from');
  const to = readDate(requestUrl, 'to');
  if (from && to) {
    validateRange(from, to);
  }
  const action = requestUrl.searchParams.get('action')?.trim() || null;
  if (action && (action.length > 100 || !/^[a-z0-9.-]+$/i.test(action))) {
    throw invalidRequest('action is invalid.');
  }
  const actor = requestUrl.searchParams.get('actorUserId');
  return {
    from,
    to,
    action,
    actorUserId: actor ? parseValue(actor, uuidSchema, 'actorUserId') : null,
    limit: readLimit(requestUrl),
    cursor: readCursor(requestUrl, uuidSchema),
  };
}

function matchUserRoute(path: string): {
  readonly userId: string;
  readonly action: 'suspend' | 'restore' | 'revoke-sessions' | null;
} | null {
  const prefix = `${API_ROUTES.adminUsers}/`;
  if (!path.startsWith(prefix)) {
    return null;
  }
  const parts = path.slice(prefix.length).split('/');
  if (parts.length < 1 || parts.length > 2) {
    throw notFound();
  }
  const userId = parseValue(
    decodeSegment(parts[0] ?? ''),
    uuidSchema,
    'userId',
  );
  const action = parts[1]
    ? parseValue(decodeSegment(parts[1]), actionSchema, 'action')
    : null;
  return { userId, action };
}

function matchTripMetadataRoute(path: string): string | null {
  const prefix = `${API_ROUTES.adminTrips}/`;
  const suffix = '/metadata';
  if (!path.startsWith(prefix) || !path.endsWith(suffix)) {
    return null;
  }
  const raw = path.slice(prefix.length, -suffix.length);
  if (!raw || raw.includes('/')) {
    throw notFound();
  }
  return parseValue(decodeSegment(raw), tripIdSchema, 'tripId');
}

function parseActionBody(
  action: 'suspend' | 'restore' | 'revoke-sessions',
  body: unknown,
): 'abuse' | 'request' | 'other' | undefined {
  const schema =
    action === 'suspend'
      ? z.strictObject({ reasonCode: adminReasonCodeSchema.optional() })
      : z.strictObject({});
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw invalidRequest('The administrator action body is invalid.');
  }
  return action === 'suspend' && 'reasonCode' in parsed.data
    ? parsed.data.reasonCode
    : undefined;
}

function readQuery(requestUrl: URL, key: string): string {
  const value =
    requestUrl.searchParams.get(key)?.normalize('NFKC').trim() ?? '';
  if (value.length > 100 || hasControlCharacter(value)) {
    throw invalidRequest(`${key} is invalid.`);
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function readLimit(requestUrl: URL): number {
  const value = requestUrl.searchParams.get('limit');
  if (value === null) {
    return 25;
  }
  if (!/^\d{1,3}$/.test(value)) {
    throw invalidRequest('limit is invalid.');
  }
  const limit = Number(value);
  if (limit < 1 || limit > 100) {
    throw invalidRequest('limit must be between 1 and 100.');
  }
  return limit;
}

function readCursor(
  requestUrl: URL,
  idSchema: z.ZodType<string>,
): AdminPageCursor | null {
  const value = requestUrl.searchParams.get('cursor');
  if (!value) {
    return null;
  }
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw invalidRequest('cursor is invalid.');
  }
  try {
    const decoded = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as unknown;
    const parsed = z
      .strictObject({ at: z.iso.datetime(), id: idSchema })
      .safeParse(decoded);
    if (!parsed.success) {
      throw new Error('invalid cursor');
    }
    return { at: new Date(parsed.data.at), id: parsed.data.id };
  } catch {
    throw invalidRequest('cursor is invalid.');
  }
}

function readEnum<const Values extends readonly [string, ...string[]]>(
  requestUrl: URL,
  key: string,
  values: Values,
): Values[number] | null {
  const value = requestUrl.searchParams.get(key);
  if (value === null || value === '') {
    return null;
  }
  return parseValue(value, z.enum(values), key);
}

function readDate(requestUrl: URL, key: string): Date | null {
  const value = requestUrl.searchParams.get(key);
  if (!value) {
    return null;
  }
  const parsed = z.iso.datetime().safeParse(value);
  if (!parsed.success) {
    throw invalidRequest(`${key} must be an ISO timestamp.`);
  }
  return new Date(parsed.data);
}

function validateRange(from: Date, to: Date): void {
  const range = to.valueOf() - from.valueOf();
  if (range <= 0 || range > maximumRangeMs) {
    throw invalidRequest(
      'The requested time range must be positive and at most 90 days.',
    );
  }
}

function parseValue<Output>(
  value: string,
  schema: z.ZodType<Output>,
  key: string,
): Output {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw invalidRequest(`${key} is invalid.`);
  }
  return parsed.data;
}

function decodeSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw invalidRequest('The request path is invalid.');
  }
}

function readSingleHeader(
  request: IncomingMessage,
  name: string,
): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? undefined : value;
}

function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type']
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== 'application/json') {
    throw new AdminHttpError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'Content-Type must be application/json.',
    );
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maximumBodyBytes) {
        chunks.length = 0;
        reject(
          new AdminHttpError(
            413,
            'REQUEST_TOO_LARGE',
            'The request body is too large.',
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (size > maximumBodyBytes) {
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
      } catch {
        reject(invalidRequest('The request body must contain valid JSON.'));
      }
    });
    request.on('error', reject);
    request.on('aborted', () =>
      reject(invalidRequest('The request was aborted.')),
    );
  });
}

function invalidRequest(message: string): AdminHttpError {
  return new AdminHttpError(400, 'ADMIN_INVALID_REQUEST', message);
}

function notFound(): AdminHttpError {
  return new AdminHttpError(
    404,
    'ADMIN_NOT_FOUND',
    'The administrator resource was not found.',
  );
}

function sendAdminError(response: ServerResponse, cause: unknown): void {
  let error: AdminHttpError;
  if (cause instanceof AdminHttpError) {
    error = cause;
  } else if (cause instanceof AdminAuthenticationRequiredError) {
    error = new AdminHttpError(401, 'ADMIN_AUTH_REQUIRED', cause.message);
  } else if (
    cause instanceof AdminForbiddenError ||
    cause instanceof AdminActorNoLongerAuthorizedError
  ) {
    error = new AdminHttpError(
      403,
      'ADMIN_FORBIDDEN',
      'Administrator access is not allowed.',
    );
  } else if (cause instanceof AdminRequiresPostgresError) {
    error = new AdminHttpError(503, 'ADMIN_REQUIRES_POSTGRES', cause.message);
  } else if (
    cause instanceof AdminUnavailableError ||
    cause instanceof AdminCsrfConfigurationError
  ) {
    error = new AdminHttpError(
      503,
      'ADMIN_UNAVAILABLE',
      'Administrator features are temporarily unavailable.',
    );
  } else if (cause instanceof AdminCsrfValidationError) {
    error = new AdminHttpError(403, 'ADMIN_CSRF_INVALID', cause.message);
  } else {
    error = new AdminHttpError(
      503,
      'ADMIN_UNAVAILABLE',
      'Administrator features are temporarily unavailable.',
    );
  }
  if (error.allow) {
    response.setHeader('Allow', error.allow);
  }
  const body: ApiErrorResponse = {
    error: { code: error.code, message: error.message },
  };
  sendJson(response, error.status, body);
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status);
  response.end(JSON.stringify(body));
}

function completeOperationsSummary(
  summary: Awaited<ReturnType<AdminRepository['getOperationsSummary']>>,
  trouteJobs: Pick<TrouteJobRepository, 'listRecentOperationalMetadata'> | null,
): Awaited<ReturnType<AdminRepository['getOperationsSummary']>> {
  const services = externalApiServiceSchema.options.map((service) => {
    const observed = summary.services.find((item) => item.service === service);
    return {
      service,
      configured: isServiceConfigured(service),
      actualCalls: observed?.actualCalls ?? 0,
      failedCalls: observed?.failedCalls ?? 0,
      avgDurationMs: observed?.avgDurationMs ?? null,
      lastObservedAt: observed?.lastObservedAt ?? null,
      recentErrorCodes: observed?.recentErrorCodes ?? [],
    };
  });
  const recentJobs = trouteJobs?.listRecentOperationalMetadata(1000) ?? [];
  const latestJob = recentJobs[0];
  return {
    ...summary,
    services,
    jobMirrors: [
      {
        service: 'troute',
        available: trouteJobs !== null,
        observedJobs: recentJobs.length,
        runningJobs: recentJobs.filter(
          (job) => job.status === 'pending' || job.status === 'running',
        ).length,
        failedJobs: recentJobs.filter((job) => job.status === 'failed').length,
        lastUpdatedAt: latestJob
          ? new Date(latestJob.updatedAt).toISOString()
          : null,
      },
      {
        service: 'tcache',
        available: false,
        observedJobs: 0,
        runningJobs: 0,
        failedJobs: 0,
        lastUpdatedAt: null,
      },
    ],
  };
}

function isServiceConfigured(
  service: z.infer<typeof externalApiServiceSchema>,
): boolean {
  switch (service) {
    case 'google-places':
      return hasEnvironmentValue('GOOGLE_PLACES_API_KEY');
    case 'google-routes':
      return hasEnvironmentValue('GOOGLE_ROUTES_API_KEY');
    case 'gemini':
      return hasEnvironmentValue('GEMINI_API_KEY');
    case 'openwebui':
      return hasEnvironmentValue('OPENWEBUI_API_KEY');
    case 'troute':
      return hasEnvironmentValue('TROUTE_BASE_URL');
    case 'tcache':
      return hasEnvironmentValue('TCACHE_BASE_URL');
    case 'ssu-sso':
      return Boolean(ssuCallbackUrl());
    case 'google-oauth':
      return (
        hasEnvironmentValue('GOOGLE_OAUTH_CLIENT_ID') &&
        hasEnvironmentValue('GOOGLE_OAUTH_CLIENT_SECRET') &&
        hasEnvironmentValue('GOOGLE_OAUTH_REDIRECT_URI')
      );
  }
}

function hasEnvironmentValue(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}
