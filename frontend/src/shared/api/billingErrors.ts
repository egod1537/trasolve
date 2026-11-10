import { L } from '@/shared/i18n';

export function billingErrorMessage(code: unknown): string | null {
  switch (code) {
    case 'TOKENS_INSUFFICIENT':
      return L('auth:billing.insufficient');
    case 'AUTHENTICATION_REQUIRED':
      return L('auth:billing.signInRequired');
    case 'PAYMENT_NOT_CONFIGURED':
      return L('auth:billing.notConfigured');
    case 'PAYMENT_DEBUG_DISABLED':
      return L('auth:billing.debugDisabled');
    case 'SUBSCRIPTION_EXISTS':
      return L('auth:billing.subscriptionExists');
    case 'PAYMENT_PENDING':
      return L('auth:billing.pending');
    case 'PAYMENT_DECLINED':
      return L('auth:billing.declined');
    case 'PAYMENT_CLOSED':
    case 'PAYMENT_EXPIRED':
      return L('auth:billing.expired');
    case 'TOKEN_REQUEST_REPLAY':
      return L('auth:billing.duplicate');
    case 'PAYMENT_MISMATCH':
    case 'INVALID_PAYMENT':
    case 'PAYMENT_FORBIDDEN':
    case 'PAYMENT_PROVIDER_ERROR':
    case 'PAYMENT_UNAVAILABLE':
    case 'TOKEN_REQUEST_ID_REQUIRED':
    case 'PAYMENT_NOT_FOUND':
    case 'SUBSCRIPTION_MISSING':
      return L('auth:billing.error');
    default:
      return null;
  }
}

export function readBillingError(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('error' in body)) {
    return null;
  }
  const error = body.error;
  return error && typeof error === 'object' && 'code' in error
    ? billingErrorMessage(error.code)
    : null;
}
