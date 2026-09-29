-- Public read-only Trip links. A disabled share has no row, so disabling a
-- link invalidates its token immediately and re-enabling creates a fresh one.

CREATE TABLE trasolve.trip_shares (
    trip_id text PRIMARY KEY REFERENCES trasolve.trips(id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE RESTRICT,
    share_token uuid NOT NULL,
    searchable boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT trip_shares_share_token_unique UNIQUE (share_token),
    CONSTRAINT trip_shares_timestamps_ordered CHECK (updated_at >= created_at)
);

CREATE INDEX trip_shares_searchable_idx
    ON trasolve.trip_shares (updated_at DESC, trip_id)
    WHERE searchable = true;

COMMENT ON COLUMN trasolve.trip_shares.share_token IS
'Opaque public URL token only. The backend stores no frontend origin or complete share URL.';
