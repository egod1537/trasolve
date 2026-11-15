-- Privacy-minimized telemetry for actual backend outbound attempts and
-- separately classified blocked/mock calls.

CREATE TABLE trasolve.external_api_call_events (
    id uuid PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    actor_user_id uuid REFERENCES trasolve.users(id) ON DELETE SET NULL,
    service text NOT NULL,
    operation text NOT NULL,
    origin_kind text NOT NULL,
    outcome text NOT NULL,
    http_status integer,
    duration_ms integer,
    provider_request_count integer NOT NULL DEFAULT 1,
    input_tokens integer,
    output_tokens integer,
    context_kind text,
    error_code text,
    CONSTRAINT external_api_service_allowed CHECK (service IN (
        'google-places', 'google-routes', 'gemini', 'openwebui',
        'troute', 'tcache', 'google-oauth'
    )),
    CONSTRAINT external_api_operation_length
        CHECK (octet_length(operation) BETWEEN 1 AND 100),
    CONSTRAINT external_api_origin_allowed
        CHECK (origin_kind IN ('backend', 'gateway')),
    CONSTRAINT external_api_outcome_allowed
        CHECK (outcome IN ('success', 'http_error', 'network_error', 'blocked', 'mock')),
    CONSTRAINT external_api_http_status_range
        CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
    CONSTRAINT external_api_duration_nonnegative
        CHECK (duration_ms IS NULL OR duration_ms >= 0),
    CONSTRAINT external_api_request_count_valid CHECK (
        (outcome IN ('blocked', 'mock') AND provider_request_count = 0)
        OR (outcome NOT IN ('blocked', 'mock') AND provider_request_count > 0)
    ),
    CONSTRAINT external_api_token_counts_nonnegative CHECK (
        (input_tokens IS NULL OR input_tokens >= 0)
        AND (output_tokens IS NULL OR output_tokens >= 0)
    ),
    CONSTRAINT external_api_context_allowed CHECK (
        context_kind IS NULL OR context_kind IN ('user-request', 'system')
    ),
    CONSTRAINT external_api_error_code_length CHECK (
        error_code IS NULL OR octet_length(error_code) BETWEEN 1 AND 100
    )
);

CREATE INDEX external_api_calls_occurred_idx
    ON trasolve.external_api_call_events (occurred_at DESC);
CREATE INDEX external_api_calls_service_occurred_idx
    ON trasolve.external_api_call_events (service, occurred_at DESC);
CREATE INDEX external_api_calls_actor_occurred_idx
    ON trasolve.external_api_call_events (actor_user_id, occurred_at DESC)
    WHERE actor_user_id IS NOT NULL;

COMMENT ON TABLE trasolve.external_api_call_events IS
'Backend outbound attempt telemetry. Browser Maps JavaScript traffic and downstream provider internals are outside this coverage.';
COMMENT ON COLUMN trasolve.external_api_call_events.provider_request_count IS
'Zero for blocked/mock classifications; positive for actual outbound attempts. Retries are stored as separate events.';
