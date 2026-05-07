-- Migration 003: Create transactions, refunds, and fraud assessments tables

CREATE TABLE transactions (
    id                          UUID PRIMARY KEY,
    merchant_id                 UUID NOT NULL REFERENCES merchants(id),
    customer_id                 UUID NOT NULL REFERENCES customers(id),
    stripe_payment_intent_id    TEXT NOT NULL UNIQUE,
    amount                      INTEGER NOT NULL CHECK (amount > 0),
    currency                    CHAR(3) NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'pending'
                                    CHECK (status IN (
                                        'pending', 'processing', 'succeeded', 'failed',
                                        'cancelled', 'requires_capture', 'requires_action',
                                        'refunded', 'partially_refunded', 'disputed'
                                    )),
    description                 TEXT,
    risk_score                  SMALLINT CHECK (risk_score BETWEEN 0 AND 100),
    failure_code                TEXT,
    failure_message             TEXT,
    metadata                    JSONB NOT NULL DEFAULT '{}',
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_merchant_id ON transactions (merchant_id);
CREATE INDEX idx_transactions_customer_id ON transactions (customer_id);
CREATE INDEX idx_transactions_status ON transactions (status);
CREATE INDEX idx_transactions_created_at ON transactions (created_at DESC);
CREATE INDEX idx_transactions_stripe_id ON transactions (stripe_payment_intent_id);

CREATE TABLE refunds (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id      UUID NOT NULL REFERENCES transactions(id),
    stripe_refund_id    TEXT NOT NULL UNIQUE,
    amount              INTEGER NOT NULL CHECK (amount > 0),
    reason              TEXT,
    status              TEXT NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refunds_transaction_id ON refunds (transaction_id);

CREATE TRIGGER transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
