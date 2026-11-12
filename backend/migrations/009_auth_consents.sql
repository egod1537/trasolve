-- Versioned consent history. Do not backfill consent for existing accounts.
CREATE TABLE trasolve.auth_consents (
    user_id uuid NOT NULL REFERENCES trasolve.users(id) ON DELETE CASCADE,
    terms_version text NOT NULL,
    privacy_version text NOT NULL,
    accepted_at timestamptz NOT NULL,
    profile_accepted boolean NOT NULL,
    age_confirmed boolean NOT NULL CHECK (age_confirmed),
    PRIMARY KEY (user_id, terms_version, privacy_version),
    CHECK (char_length(terms_version) BETWEEN 1 AND 40),
    CHECK (char_length(privacy_version) BETWEEN 1 AND 40)
);

COMMENT ON TABLE trasolve.auth_consents IS
'Explicit terms acceptance and collection/use consent. Server-stamped receipts are immutable per document-version pair; absence never implies consent.';
