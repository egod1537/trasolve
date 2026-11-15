-- Append-only audit records for privileged state changes.

CREATE TABLE trasolve.admin_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE RESTRICT,
    action text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT admin_audit_action_length
        CHECK (octet_length(action) BETWEEN 1 AND 100),
    CONSTRAINT admin_audit_target_type_length
        CHECK (octet_length(target_type) BETWEEN 1 AND 100),
    CONSTRAINT admin_audit_target_id_length
        CHECK (octet_length(target_id) BETWEEN 1 AND 200),
    CONSTRAINT admin_audit_metadata_object
        CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX admin_audit_created_idx
    ON trasolve.admin_audit_events (created_at DESC, id DESC);
CREATE INDEX admin_audit_actor_created_idx
    ON trasolve.admin_audit_events (actor_user_id, created_at DESC, id DESC);
CREATE INDEX admin_audit_target_created_idx
    ON trasolve.admin_audit_events (target_type, target_id, created_at DESC);

COMMENT ON TABLE trasolve.admin_audit_events IS
'Append-only privileged action history. Application APIs must not update or delete rows.';
COMMENT ON COLUMN trasolve.admin_audit_events.metadata IS
'Allowlisted scalar operational metadata only; never store email, request bodies, session values, credentials or Trip documents.';
