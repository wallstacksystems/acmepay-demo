-- Migration 002: Create customers table
-- Stores end-customer PII. Sensitive fields (SSN, DOB) are encrypted at the application layer
-- before insertion. country is stored in plaintext for fraud/AML checks.

CREATE TABLE customers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    stripe_customer_id  TEXT UNIQUE,
    email               TEXT NOT NULL,
    first_name          TEXT NOT NULL,
    last_name           TEXT NOT NULL,
    phone               TEXT,
    -- date_of_birth is AES-256-GCM encrypted; see src/utils/crypto.js
    date_of_birth       TEXT,
    country             CHAR(2),
    address             JSONB,
    kyc_status          TEXT NOT NULL DEFAULT 'not_started'
                            CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected', 'expired')),
    metadata            JSONB NOT NULL DEFAULT '{}',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Composite unique: same email can exist across different merchants
CREATE UNIQUE INDEX idx_customers_merchant_email ON customers (merchant_id, email);
CREATE INDEX idx_customers_merchant_id ON customers (merchant_id);
CREATE INDEX idx_customers_stripe_id ON customers (stripe_customer_id);
CREATE INDEX idx_customers_country ON customers (country);

CREATE TABLE kyc_verifications (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL DEFAULT 'persona',
    provider_inquiry_id TEXT,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
    failure_reason      TEXT,
    raw_payload         JSONB,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kyc_customer_id ON kyc_verifications (customer_id);

CREATE TRIGGER customers_updated_at
    BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
