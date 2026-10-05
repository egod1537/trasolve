-- Append-only raw analytics event storage.
-- Target: PostgreSQL 16+. Transaction control is owned by the migration runner.

CREATE TABLE trasolve.analytics_events (
    id uuid PRIMARY KEY,
    session_id text NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    screen text NOT NULL,
    target text,
    occurred_at timestamptz NOT NULL,
    metadata jsonb,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT analytics_events_user_fk
        FOREIGN KEY (user_id)
        REFERENCES trasolve.users(id)
        ON DELETE SET NULL,
    CONSTRAINT analytics_events_session_id_nonempty
        CHECK (octet_length(session_id) > 0),
    CONSTRAINT analytics_events_event_type_nonempty
        CHECK (octet_length(event_type) > 0),
    CONSTRAINT analytics_events_screen_nonempty
        CHECK (octet_length(screen) > 0),
    CONSTRAINT analytics_events_target_nonempty
        CHECK (target IS NULL OR octet_length(target) > 0),
    CONSTRAINT analytics_events_metadata_object
        CHECK (metadata IS NULL OR jsonb_typeof(metadata) = 'object')
);

CREATE INDEX analytics_events_session_occurred_idx
    ON trasolve.analytics_events (session_id, occurred_at);
CREATE INDEX analytics_events_type_occurred_idx
    ON trasolve.analytics_events (event_type, occurred_at);
CREATE INDEX analytics_events_user_occurred_idx
    ON trasolve.analytics_events (user_id, occurred_at)
    WHERE user_id IS NOT NULL;

COMMENT ON TABLE trasolve.analytics_events IS
'Append-only raw UX analytics events. Runtime code must not update or delete rows; re-run aggregation when analysis logic changes.';
COMMENT ON COLUMN trasolve.analytics_events.user_id IS
'Authenticated user at ingestion time. A hard-deleted user is unlinked with ON DELETE SET NULL while the raw event is retained.';
COMMENT ON COLUMN trasolve.analytics_events.event_type IS
'Stable application event identifier validated against the shared analytics event schema before insertion.';
COMMENT ON COLUMN trasolve.analytics_events.metadata IS
'Validated JSON object containing allowlisted analytics dimensions only; never store user-authored text, email or credentials.';
