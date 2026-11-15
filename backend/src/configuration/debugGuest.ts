export function isDebugGuestAuthenticationEnabled(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = environment.TRASOLVE_DEBUG_GUEST_AUTH?.trim();
  if (!configured) {
    return environment.NODE_ENV !== 'production';
  }
  if (configured === 'true') {
    return true;
  }
  if (configured === 'false') {
    return false;
  }
  throw new Error('TRASOLVE_DEBUG_GUEST_AUTH must be true or false.');
}

export function resolveDebugGuestSubject(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const subject = environment.TRASOLVE_DEBUG_GUEST_SUBJECT?.trim() || 'default';
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(subject)) {
    throw new Error(
      'TRASOLVE_DEBUG_GUEST_SUBJECT must use lowercase letters, digits, and hyphens.',
    );
  }
  return subject;
}
