import type { Database } from '../../database/database.js';
import type {
  ExternalApiCallEvent,
  ExternalApiUsageWriter,
} from './externalApiUsage.js';

export class PostgresExternalApiUsageWriter implements ExternalApiUsageWriter {
  public constructor(private readonly database: Database) {}

  public async append(events: readonly ExternalApiCallEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }
    const payload = events.map((event) => ({
      id: event.id,
      occurred_at: event.occurredAt.toISOString(),
      actor_user_id: event.actorUserId,
      service: event.service,
      operation: event.operation.slice(0, 100),
      origin_kind: event.originKind,
      outcome: event.outcome,
      http_status: event.httpStatus,
      duration_ms: event.durationMs,
      provider_request_count: event.providerRequestCount,
      input_tokens: event.inputTokens,
      output_tokens: event.outputTokens,
      context_kind: event.contextKind,
      error_code: event.errorCode?.slice(0, 100) ?? null,
    }));
    await this.database.query(
      `INSERT INTO trasolve.external_api_call_events (
         id, occurred_at, actor_user_id, service, operation, origin_kind,
         outcome, http_status, duration_ms, provider_request_count,
         input_tokens, output_tokens, context_kind, error_code
       )
       SELECT
         record.id,
         record.occurred_at,
         record.actor_user_id,
         record.service,
         record.operation,
         record.origin_kind,
         record.outcome,
         record.http_status,
         record.duration_ms,
         record.provider_request_count,
         record.input_tokens,
         record.output_tokens,
         record.context_kind,
         record.error_code
       FROM jsonb_to_recordset($1::jsonb) AS record(
         id uuid,
         occurred_at timestamptz,
         actor_user_id uuid,
         service text,
         operation text,
         origin_kind text,
         outcome text,
         http_status integer,
         duration_ms integer,
         provider_request_count integer,
         input_tokens integer,
         output_tokens integer,
         context_kind text,
         error_code text
       )`,
      [JSON.stringify(payload)],
    );
  }
}
