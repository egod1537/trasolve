-- Administrative authorization state. Runtime authorization must also require
-- a verified canonical Google identity for the same internal user id.

ALTER TABLE trasolve.users
    ADD COLUMN role text NOT NULL DEFAULT 'user',
    ADD COLUMN suspended_at timestamptz,
    ADD CONSTRAINT users_role_allowed CHECK (role IN ('user', 'admin')),
    ADD CONSTRAINT users_suspension_after_creation CHECK (
        suspended_at IS NULL OR suspended_at >= created_at
    );

COMMENT ON COLUMN trasolve.users.role IS
'Server-authoritative application role. Never derive this value from email, browser state or an OAuth claim.';
COMMENT ON COLUMN trasolve.users.suspended_at IS
'Non-null while application access is suspended. Suspension is independent from soft deletion.';

-- Authorization reads users by primary key, so no role-only index is added.
-- Add a partial role index only after production EXPLAIN evidence shows a
-- role-wide administrative query needs one.
