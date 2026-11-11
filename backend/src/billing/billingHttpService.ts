import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  type BillingSummary,
  confirmPaymentSchema,
  createPaymentSchema,
  type TokenAction,
} from '@trasolve/shared';
import { z } from 'zod';
import {
  AuthenticationRequiredError,
  type CurrentUserResolver,
} from '../auth/currentUserResolver.js';
import type { BillingService } from './billingService.js';
import type { BillingOwner } from './billingRepository.js';
import { BillingError } from './paymentProvider.js';

const tokenDebugHeader = 'x-trasolve-token-debug';

function isTokenDebugRequested(request: IncomingMessage): boolean {
  return request.headers[tokenDebugHeader] === '1';
}

export function validateBillingRequest(request: IncomingMessage): void {
  if (
    request.headers['x-trasolve-billing'] !== '1' ||
    request.headers['sec-fetch-site'] === 'cross-site'
  ) {
    throw new BillingError('PAYMENT_FORBIDDEN', 403);
  }
  if (request.headers.origin) {
    const configured = process.env.TRASOLVE_PUBLIC_ORIGIN;
    const origin = new URL(request.headers.origin);
    const expected = configured
      ? new URL(configured).origin
      : `${origin.protocol}//${request.headers.host}`;
    if (origin.origin !== expected) {
      throw new BillingError('PAYMENT_FORBIDDEN', 403);
    }
  }
}

export class TokenMeter {
  public constructor(
    private readonly billing: BillingService,
    private readonly currentUser: CurrentUserResolver,
  ) {}
  public async run<T>(
    request: IncomingMessage,
    action: TokenAction,
    operation: () => Promise<T>,
  ): Promise<T> {
    validateBillingRequest(request);
    const key = z.uuid().safeParse(request.headers['x-trasolve-request-id']);
    if (!key.success) {
      throw new BillingError('TOKEN_REQUEST_ID_REQUIRED');
    }
    const userId = await this.currentUser.resolve(request);
    if (!userId) {
      throw new BillingError('AUTHENTICATION_REQUIRED', 401);
    }
    const owner = this.billing.owner(userId);
    if (this.billing.isUsageUnlimited(owner, isTokenDebugRequested(request))) {
      return operation();
    }
    await this.billing.reserve(owner, action, key.data);
    let succeeded = false;
    try {
      const result = await operation();
      succeeded = true;
      return result;
    } finally {
      // An unavailable ledger must fail closed. Unsettled reservations are
      // recovered after fifteen minutes by summary(), never double charged.
      await this.billing.settle(owner, key.data, succeeded);
    }
  }
}

export class BillingHttpService {
  public constructor(
    private readonly billing: BillingService,
    private readonly currentUser: CurrentUserResolver,
  ) {}
  public async handle(
    request: IncomingMessage,
    response: ServerResponse,
    url: URL,
  ): Promise<void> {
    response.setHeader('Cache-Control', 'no-store');
    try {
      const path = url.pathname.slice('/api/billing'.length);
      if (path === '/webhook') {
        this.method(request, 'POST');
        const body = z
          .object({ data: z.object({ orderId: z.string().uuid() }) })
          .parse(await readJson(request));
        // Do not trust webhook state or amounts. Re-read the payment from Toss.
        await this.billing.reconcile(body.data.orderId);
        send(response, 200, { ok: true });
        return;
      }
      const userId = await this.currentUser.require(request);
      const owner = this.billing.owner(userId);
      if (path === '/summary') {
        this.method(request, 'GET');
        send(response, 200, await this.summary(owner, request));
        return;
      }
      this.method(request, 'POST');
      validateBillingRequest(request);
      const body = await readJson(request);
      if (path === '/orders') {
        const input = createPaymentSchema.parse(body);
        send(
          response,
          201,
          await this.billing.createOrder(owner, input.productId),
        );
        return;
      }
      if (path === '/confirm') {
        const summary = await this.billing.confirm(
          owner,
          confirmPaymentSchema.parse(body),
        );
        send(response, 200, this.withTokenDebug(owner, summary, request));
        return;
      }
      if (path === '/subscription/cancel') {
        const summary = await this.billing.cancelSubscription(owner);
        send(response, 200, this.withTokenDebug(owner, summary, request));
        return;
      }
      const abort = /^\/orders\/([a-f0-9-]+)\/abort$/.exec(path);
      if (abort) {
        await this.billing.abandon(owner, z.uuid().parse(abort[1]));
        send(response, 200, await this.summary(owner, request));
        return;
      }
      throw new BillingError('PAYMENT_NOT_FOUND', 404);
    } catch (cause) {
      const error =
        cause instanceof BillingError
          ? cause
          : cause instanceof AuthenticationRequiredError
            ? new BillingError('AUTHENTICATION_REQUIRED', 401)
            : cause instanceof z.ZodError
              ? new BillingError('INVALID_PAYMENT')
              : new BillingError('PAYMENT_UNAVAILABLE', 503);
      send(response, error.status, {
        error: { code: error.code, message: error.code },
      });
    }
  }
  private method(request: IncomingMessage, method: string): void {
    if (request.method !== method) {
      throw new BillingError('METHOD_NOT_ALLOWED', 405);
    }
  }
  private async summary(
    owner: BillingOwner,
    request: IncomingMessage,
  ): Promise<BillingSummary> {
    return this.billing.summary(owner, isTokenDebugRequested(request));
  }
  private withTokenDebug(
    owner: BillingOwner,
    summary: BillingSummary,
    request: IncomingMessage,
  ): BillingSummary {
    const unlimited = this.billing.isUsageUnlimited(
      owner,
      isTokenDebugRequested(request),
    );
    return {
      ...summary,
      unlimited,
      costs: unlimited ? { chat: 0, optimize: 0 } : summary.costs,
    };
  }
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  if (
    request.headers['content-type']?.split(';')[0]?.trim() !==
    'application/json'
  ) {
    throw new BillingError('INVALID_PAYMENT', 415);
  }
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const data of request) {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    length += chunk.length;
    if (length > 8192) {
      throw new BillingError('INVALID_PAYMENT', 413);
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new BillingError('INVALID_PAYMENT');
  }
}
function send(response: ServerResponse, status: number, body: unknown): void {
  if (response.destroyed || response.writableEnded) {
    return;
  }
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}
