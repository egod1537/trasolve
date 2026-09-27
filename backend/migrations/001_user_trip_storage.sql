-- Trasolve initial PostgreSQL schema.
-- Target: PostgreSQL 16+. Transaction control is owned by the migration runner.
-- gen_random_uuid() is a built-in function on the target versions.
-- Authentication, authorization, JSON domain validation and migration adapters
-- MUST be implemented in the backend before using this schema with real users.
-- SQL constraints alone do NOT provide request-level authorization.

CREATE SCHEMA trasolve;

-- Used on users/trips. A conditional UPDATE must still check the expected
-- revision; this trigger advances the revision but does not detect stale input.
CREATE FUNCTION trasolve.advance_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_at := OLD.created_at;
    NEW.updated_at := clock_timestamp();
    NEW.revision := OLD.revision + 1;
    RETURN NEW;
END;
$$;

CREATE TABLE trasolve.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name text NOT NULL DEFAULT '',
    avatar_url text,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    settings_schema_version integer NOT NULL DEFAULT 1,
    revision bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT users_display_name_length CHECK (char_length(display_name) <= 200),
    CONSTRAINT users_settings_object CHECK (jsonb_typeof(settings) = 'object'),
    CONSTRAINT users_settings_version_positive CHECK (settings_schema_version > 0),
    CONSTRAINT users_revision_positive CHECK (revision > 0),
    CONSTRAINT users_timestamps_ordered CHECK (updated_at >= created_at)
);

CREATE TRIGGER users_advance_revision
BEFORE UPDATE ON trasolve.users
FOR EACH ROW EXECUTE FUNCTION trasolve.advance_revision();

-- One service user may have multiple external login identities.
-- For Google, issuer is the server-configured canonical issuer
-- 'https://accounts.google.com', and subject is the validated Google `sub`.
-- Never use an email match to automatically link different accounts.
CREATE TABLE trasolve.auth_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE CASCADE,
    issuer text COLLATE "C" NOT NULL,
    subject text COLLATE "C" NOT NULL,
    email text,
    email_verified boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login_at timestamptz,
    CONSTRAINT auth_identity_unique UNIQUE (issuer, subject),
    CONSTRAINT auth_issuer_length CHECK (octet_length(issuer) BETWEEN 1 AND 512),
    CONSTRAINT auth_subject_length CHECK (octet_length(subject) BETWEEN 1 AND 255),
    CONSTRAINT auth_verified_email_present CHECK (NOT email_verified OR email IS NOT NULL)
);

CREATE INDEX auth_identities_user_idx ON trasolve.auth_identities (user_id);

-- Generate a fresh random 32-byte session secret on login. Put its base64url
-- encoding in an HttpOnly cookie and persist only its SHA-256 digest here.
-- Pick one hashing representation (e.g. the UTF-8 cookie string) and use it
-- consistently on both insertion and lookup. Do not log secrets or digests.
CREATE TABLE trasolve.auth_sessions (
    token_hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CONSTRAINT auth_session_hash_length CHECK (octet_length(token_hash) = 32),
    CONSTRAINT auth_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX auth_sessions_user_idx ON trasolve.auth_sessions (user_id);
CREATE INDEX auth_sessions_expiry_idx ON trasolve.auth_sessions (expires_at);

-- Keep title/dates/ownership/timestamps in columns ONLY.
-- document holds {"days": [...]} plus future, validated content fields.
-- No day/place/polyline tables initially: current PUT replaces a whole trip.
-- text IDs preserve the existing ID contract and possible non-UUID legacy IDs;
-- newly created IDs default to UUID strings. Nested IDs remain inside document.
CREATE TABLE trasolve.trips (
    id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
    owner_user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE RESTRICT,
    title text NOT NULL,
    start_date date,
    end_date date,
    document jsonb NOT NULL DEFAULT '{"days":[]}'::jsonb,
    schema_version integer NOT NULL DEFAULT 1,
    revision bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT trip_id_format CHECK (id ~ '^[a-zA-Z0-9_-]{1,128}$'),
    CONSTRAINT trip_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
    CONSTRAINT trip_date_range CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date),
    CONSTRAINT trip_document_object CHECK (jsonb_typeof(document) = 'object'),
    CONSTRAINT trip_document_days CHECK (document ? 'days' AND jsonb_typeof(document -> 'days') = 'array'),
    CONSTRAINT trip_document_no_duplicate_metadata CHECK (
        NOT (document ?| ARRAY[
            'id', 'userId', 'ownerUserId', 'title', 'startDate', 'endDate',
            'createdAt', 'updatedAt', 'revision', 'schemaVersion'
        ])
    ),
    CONSTRAINT trip_schema_version_positive CHECK (schema_version > 0),
    CONSTRAINT trip_revision_positive CHECK (revision > 0),
    CONSTRAINT trip_timestamps_ordered CHECK (updated_at >= created_at)
);

CREATE TRIGGER trips_advance_revision
BEFORE UPDATE ON trasolve.trips
FOR EACH ROW EXECUTE FUNCTION trasolve.advance_revision();

-- The full owner index also covers FK checks for soft-deleted trips.
CREATE INDEX trips_owner_idx ON trasolve.trips (owner_user_id);
CREATE INDEX trips_owner_recent_idx
    ON trasolve.trips (owner_user_id, updated_at DESC, id)
    WHERE deleted_at IS NULL;

-- Owner is determined exclusively by trips.owner_user_id.
-- This table contains only non-owner collaborators. Owner access takes priority
-- if a redundant membership happens to exist. No sharing API is provided here.
CREATE TABLE trasolve.trip_members (
    trip_id text NOT NULL REFERENCES trasolve.trips(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE CASCADE,
    role text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (trip_id, user_id),
    CONSTRAINT trip_member_role CHECK (role IN ('viewer', 'editor'))
);

CREATE INDEX trip_members_user_idx ON trasolve.trip_members (user_id, trip_id);

COMMENT ON COLUMN trasolve.users.settings IS
'Validated user preferences only. Never store permissions, payment state, secrets or login credentials here.';
COMMENT ON COLUMN trasolve.trips.document IS
'Versioned editable trip content; exclude relational metadata. Validate nested IDs, references and ordering in the domain layer.';
COMMENT ON COLUMN trasolve.trips.schema_version IS
'Persisted document format version, independent from optimistic-lock revision.';
COMMENT ON COLUMN trasolve.trips.revision IS
'Concurrency token. Every update advances it through a trigger; writes must compare the client revision.';
COMMENT ON COLUMN trasolve.trips.owner_user_id IS
'Single source of truth for ownership. Account hard deletion requires explicit trip transfer or purge first.';

-- OWNER-ONLY CONDITIONAL SAVE EXAMPLE (parameterized by the backend; not run here)
-- $1: trip ID, $2: authenticated internal user ID, $3: expected revision,
-- $4: title, $5/$6: nullable ISO dates, $7: validated JSON, $8: document version.
-- UPDATE trasolve.trips
-- SET title = $4, start_date = $5::date, end_date = $6::date,
--     document = $7::jsonb, schema_version = $8
-- WHERE id = $1 AND owner_user_id = $2::uuid
--   AND revision = $3::bigint AND deleted_at IS NULL
-- RETURNING *;
-- The trigger increments revision. Zero rows is NOT success: distinguish
-- inaccessible/missing from stale revisions without leaking others' records.
-- Updates must never UPSERT, which could recreate a deleted trip.
