import * as Sentry from '@sentry/react';
import { buildInfo } from '@/shared/config/buildInfo';

const FILTERED_VALUE = '[Filtered]';
const SAFE_REQUEST_HEADERS = new Set(['accept', 'content-type']);
const SENSITIVE_KEY_PATTERN =
  /^(?:authorization|cookie|set-cookie|token|access_token|refresh_token|secret|password|credential|api[-_]?key|prompt|completion|messages|conversation|content|request[-_]?body|response[-_]?body|body|payload|form[-_]?data|lat|lng|latitude|longitude|coordinates|location)$/iu;
const URL_KEY_PATTERN = /^(?:url|from|to)$/iu;
const SECRET_TEXT_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu,
  /\bAIza[A-Za-z0-9_-]{20,}\b/gu,
  /([?&](?:access_token|refresh_token|token|api[-_]?key|key)=)[^&#\s]*/giu,
] as const;

export interface ExceptionCaptureDetails {
  kind: 'api' | 'workflow';
  operation: string;
  httpStatus?: number;
}

let sentryInitialized = false;

export function initSentry(): boolean {
  if (sentryInitialized) {
    return true;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn) {
    return false;
  }

  try {
    Sentry.init({
      dsn,
      environment: buildInfo.channel,
      release: buildInfo.sha || undefined,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      profileSessionSampleRate: 0,
      integrations(defaultIntegrations) {
        return defaultIntegrations.filter(
          (integration) =>
            integration.name !== 'BrowserTracing' &&
            integration.name !== 'BrowserProfiling' &&
            integration.name !== 'Replay',
        );
      },
      beforeBreadcrumb(breadcrumb) {
        if (
          breadcrumb.category?.startsWith('console') ||
          breadcrumb.category === 'ui.input'
        ) {
          return null;
        }
        scrubObject(breadcrumb.data);
        if (breadcrumb.message) {
          breadcrumb.message = redactSensitiveText(breadcrumb.message);
        }
        return breadcrumb;
      },
      beforeSend(event) {
        event.user = undefined;
        if (event.request) {
          event.request.url = sanitizeUrl(event.request.url);
          event.request.headers = filterHeaders(event.request.headers);
          event.request.cookies = undefined;
          event.request.data = undefined;
          event.request.query_string = undefined;
          event.request.env = undefined;
        }
        scrubObject(event.breadcrumbs);
        scrubObject(event.contexts);
        scrubObject(event.extra);
        scrubObject(event.tags);
        if (event.message) {
          event.message = redactSensitiveText(event.message);
        }
        for (const value of event.exception?.values ?? []) {
          if (value.value) {
            value.value = redactSensitiveText(value.value);
          }
        }
        return event;
      },
    });
    Sentry.setTag('build.channel', buildInfo.channel);
    if (buildInfo.branch) {
      Sentry.setTag('git.branch', buildInfo.branch);
    }
    sentryInitialized = true;
    return true;
  } catch (cause) {
    console.warn(
      'Sentry initialization failed; continuing without Sentry.',
      cause,
    );
    return false;
  }
}

export function captureException(
  exception: unknown,
  details: ExceptionCaptureDetails,
): void {
  if (!sentryInitialized) {
    return;
  }
  Sentry.withScope((scope) => {
    scope.setTag('error_kind', details.kind);
    scope.setTag('operation', details.operation);
    if (details.httpStatus !== undefined) {
      scope.setExtra('http_status', details.httpStatus);
    }
    Sentry.captureException(exception);
  });
}

export function captureUnexpectedApiException(
  exception: unknown,
  details: Omit<ExceptionCaptureDetails, 'kind'>,
): void {
  if (details.httpStatus !== undefined && details.httpStatus < 500) {
    return;
  }
  captureException(exception, { ...details, kind: 'api' });
}

function filterHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }
  const safeHeaders = Object.entries(headers).filter(([name]) =>
    SAFE_REQUEST_HEADERS.has(name.toLocaleLowerCase()),
  );
  return safeHeaders.length > 0 ? Object.fromEntries(safeHeaders) : undefined;
}

function sanitizeUrl(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  try {
    const absolute = /^[a-z][a-z\d+.-]*:/iu.test(value);
    const url = new URL(value, window.location.origin);
    return absolute ? `${url.origin}${url.pathname}` : url.pathname;
  } catch {
    return value.split(/[?#]/u, 1)[0];
  }
}

function scrubObject(value: unknown, visited = new WeakSet<object>()): void {
  if (!value || typeof value !== 'object' || visited.has(value)) {
    return;
  }
  visited.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry) => scrubObject(entry, visited));
    return;
  }
  const record = value as Record<string, unknown>;
  for (const [key, entry] of Object.entries(record)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      record[key] = FILTERED_VALUE;
    } else if (typeof entry === 'string') {
      record[key] = URL_KEY_PATTERN.test(key)
        ? sanitizeUrl(entry)
        : redactSensitiveText(entry);
    } else {
      scrubObject(entry, visited);
    }
  }
}

function redactSensitiveText(value: string): string {
  return SECRET_TEXT_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, FILTERED_VALUE),
    value,
  );
}
