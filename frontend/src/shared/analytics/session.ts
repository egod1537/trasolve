const ANALYTICS_SESSION_STORAGE_KEY = 'trasolve.analytics.session_id';

let memorySessionId: string | null = null;

/**
 * Returns the opaque analytics session for this browser tab. The identifier is
 * correlation data only and must never be used for authentication or authorization.
 */
export function getAnalyticsSessionId(): string {
  if (memorySessionId) {
    return memorySessionId;
  }

  try {
    const storedSessionId = window.sessionStorage.getItem(
      ANALYTICS_SESSION_STORAGE_KEY,
    );
    if (storedSessionId) {
      memorySessionId = storedSessionId;
      return storedSessionId;
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }

  const sessionId = crypto.randomUUID();
  memorySessionId = sessionId;
  try {
    window.sessionStorage.setItem(ANALYTICS_SESSION_STORAGE_KEY, sessionId);
  } catch {
    // The in-memory ID still keeps events correlated for this page lifecycle.
  }
  return sessionId;
}
