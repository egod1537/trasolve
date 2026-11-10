-- One transactional aggregate per user and payment environment. No card data.
CREATE TABLE trasolve.billing_accounts (
    user_id uuid NOT NULL REFERENCES trasolve.users(id),
    mode text NOT NULL CHECK (mode IN ('live', 'sandbox', 'debug')),
    document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, mode)
);
CREATE INDEX billing_account_orders ON trasolve.billing_accounts USING gin ((document -> 'orders'));
