// Protocol adapted from ssutoday-v3's UsaintAuthenticationAdapter (Apache-2.0).
// Reimplemented for Trasolve: strict identity matching, bounded responses,
// no department restriction, no credentials/portal HTML in logs or storage.
import { load } from 'cheerio';
import { API_ROUTES } from '@trasolve/shared';
import type { ExternalApiPolicy } from './configuration/externalApiPolicy.js';
import {
  assertInstrumentedNetworkAllowed,
  instrumentExternalApiFetch,
} from './observability/externalApiUsage/externalApiUsage.js';

const loginEndpoint = 'https://smartid.ssu.ac.kr/Symtra_sso/smln.asp';
const validationEndpoint = 'https://saint.ssu.ac.kr/webSSO/sso.jsp';
const portalEndpoint = 'https://saint.ssu.ac.kr/webSSUMain/main_student.jsp';
const maximumBodyBytes = 2 * 1024 * 1024;

export function ssuCallbackUrl(
  environment = process.env,
  requestHost?: string,
): URL | undefined {
  try {
    const explicit = environment.SSU_SSO_REDIRECT_URI;
    // Caddy is the trusted ingress: the backend has no public port and receives
    // the original, edge-routed Host. Keep SSO on that host so previews do not
    // inherit the main site's OAuth/public-origin setting and lose their cookie.
    let requestOrigin: string | undefined;
    if (requestHost) {
      const authority = requestHost.toLowerCase();
      if (!/^(?:[a-z0-9][a-z0-9.-]*|\[::1\])(?::\d{1,5})?$/.test(authority)) {
        return undefined;
      }
      const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
        authority,
      );
      const parsed = new URL(`${localHost ? 'http' : 'https'}://${authority}`);
      if (parsed.host !== authority) {
        return undefined;
      }
      requestOrigin = parsed.origin;
    }
    const url = explicit
      ? new URL(explicit)
      : new URL(
          API_ROUTES.ssuSsoCallback,
          requestOrigin ||
            environment.TRASOLVE_PUBLIC_ORIGIN ||
            new URL(environment.GOOGLE_OAUTH_REDIRECT_URI ?? '').origin,
        );
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== API_ROUTES.ssuSsoCallback
    ) {
      return undefined;
    }
    return url;
  } catch {
    return undefined;
  }
}

export function ssuAuthorizationUrl(callback: URL, state: string): string {
  const destination = new URL(callback);
  // Keep state in the callback path: the school adds its own query parameters.
  destination.pathname += `/${state}`;
  const url = new URL(loginEndpoint);
  url.searchParams.set('apiReturnUrl', destination.toString());
  return url.toString();
}

export class SsuSsoClient {
  public constructor(private readonly policy: ExternalApiPolicy) {}

  public async authenticate(
    token: string,
    studentId: string,
  ): Promise<{ subject: string; name: string }> {
    // The school ticket is opaque. Accept RFC 6265 cookie octets rather than
    // assuming an undocumented base64 encoding; reject delimiters and controls.
    if (
      !/^[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]{1,4096}$/.test(token) ||
      !/^\d{6,12}$/.test(studentId)
    ) {
      throw new Error('Invalid SSO callback.');
    }
    const url = new URL(validationEndpoint);
    url.searchParams.set('sToken', token);
    url.searchParams.set('sIdno', studentId);
    const sso = await this.request(
      url,
      `sToken=${token}; sIdno=${studentId}`,
      'validate-ticket',
    );
    const ssoHtml = await readHtml(sso);
    if (!/location\.href\s*=\s*["']\/irj\/portal["']\s*;/.test(ssoHtml)) {
      throw new Error('SSO authentication was rejected.');
    }
    const cookies = sso.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0]);
    if (!cookies.length || cookies.some((value) => /[\r\n]/.test(value))) {
      throw new Error('SSO session was not established.');
    }
    const portal = await this.request(
      new URL(portalEndpoint),
      cookies.join('; '),
      'read-identity',
    );
    const $ = load(await readHtml(portal));
    const name = $('.main_box09 span').first().text().split('님', 1)[0].trim();
    const ids = $('.main_box09_con li')
      .toArray()
      .filter((item) => $(item).find('dt').first().text().trim() === '학번')
      .map((item) => $(item).find('strong').first().text().trim());
    // Never trust the callback's student number without matching the portal.
    if (
      ids.length !== 1 ||
      ids[0] !== studentId ||
      !name ||
      name.length > 200
    ) {
      throw new Error('SSO identity could not be verified.');
    }
    return { subject: ids[0], name };
  }

  private async request(
    url: URL,
    cookies: string,
    operation: string,
  ): Promise<Response> {
    assertInstrumentedNetworkAllowed(this.policy, 'ssu-sso', operation);
    const response = await instrumentExternalApiFetch(
      'ssu-sso',
      operation,
      () =>
        fetch(url, {
          method: 'GET',
          headers: { Cookie: cookies, Accept: 'text/html' },
          redirect: 'manual',
          signal: AbortSignal.timeout(10_000),
        }),
    );
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('SSO provider request failed.');
    }
    return response;
  }
}

async function readHtml(response: Response): Promise<string> {
  if (!response.body) {
    throw new Error('Empty SSO provider response.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maximumBodyBytes) {
        await reader.cancel();
        throw new Error('SSO provider response exceeded the size limit.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  const charsetHints = `${response.headers.get('content-type') ?? ''} ${bytes.subarray(0, 4096).toString('ascii')}`;
  const encoding =
    /charset\s*=\s*["']?(euc-kr|ks_c_5601-1987|windows-949)/i.test(charsetHints)
      ? 'euc-kr'
      : 'utf-8';
  return new TextDecoder(encoding).decode(bytes);
}
