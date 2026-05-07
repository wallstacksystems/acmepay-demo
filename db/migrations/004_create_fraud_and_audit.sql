-- Migration 004: Fraud assessment table and audit log
-- audit_log is append-only; no UPDATE or DELETE should ever touch it.

CREATE TABLE fraud_assessments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID NOT NULL REFERENCES merchants(id),
    customer_id         UUID REFERENCES customers(id),
    payment_method_id   TEXT,
    score               SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    signals             JSONB NOT NULL DEFAULT '{}',
    ip_address          INET,
    amount              INTEGER,
    currency            CHAR(3),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_merchant_customer ON fraud_assessments (merchant_id, customer_id);
CREATE INDEX idx_fraud_score ON fraud_assessments (score DESC);
CREATE INDEX idx_fraud_created_at ON fraud_assessments (created_at DESC);

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    actor_id    UUID,
    actor_type  TEXT NOT NULL CHECK (actor_type IN ('merchant', 'customer', 'system', 'admin')),
    action      TEXT NOT NULL,
    resource    TEXT NOT NULL,
    resource_id UUID,
    old_values  JSONB,
    new_values  JSONB,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_log (actor_id, actor_type);
CREATE INDEX idx_audit_resource ON audit_log (resource, resource_id);
CREATE INDEX idx_audit_created_at ON audit_log (created_at DESC);

-- Revoke DELETE/UPDATE on audit_log so it's truly immutable via SQL
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
REVOKE UPDATE, DELETE ON audit_log FROM authenticated;
