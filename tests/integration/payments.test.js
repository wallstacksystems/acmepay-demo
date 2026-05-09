/**
 * Integration tests for POST /v1/payments
 * These tests mock Stripe, Supabase, and internal services so no live credentials are needed.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh';
process.env.API_KEY_SALT = 'test-salt';
process.env.DATABASE_URL = 'postgresql://localhost/acmepay_test';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.TWILIO_ACCOUNT_SID = 'AC_test';
process.env.TWILIO_AUTH_TOKEN = 'test-token';
process.env.SENDGRID_API_KEY = 'SG.test';
process.env.OPENAI_API_KEY = 'sk-test';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.ENCRYPTION_IV = 'b'.repeat(32);

const request = require('supertest');

jest.mock('@supabase/supabase-js', () => {
  const mockChain = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: {
        id: 'key-1',
        merchant_id: 'merchant-1',
        scopes: ['payments:write', 'payments:read'],
        revoked_at: null,
      },
      error: null,
    }),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
  return {
    createClient: () => ({
      from: jest.fn(() => ({ ...mockChain, count: 2 })),
    }),
  };
});

jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn().mockResolvedValue({
        id: 'pi_test_123',
        status: 'succeeded',
      }),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

jest.mock('../../src/services/fraud.service', () => ({
  evaluate: jest.fn().mockResolvedValue({ score: 10, signals: {}, blocked: false }),
}));

jest.mock('../../src/services/notification.service', () => ({
  sendPaymentConfirmation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/models/transaction', () => ({
  create: jest.fn().mockResolvedValue({
    id: 'txn_test_001',
    merchantId: 'merchant-1',
    customerId: '22222222-0000-0000-0000-000000000001',
    amount: 5000,
    currency: 'USD',
    status: 'succeeded',
    createdAt: new Date().toISOString(),
  }),
  findById: jest.fn(),
  findByStripeId: jest.fn(),
  list: jest.fn(),
  updateStatus: jest.fn(),
  recordRefund: jest.fn(),
}));

const app = require('../../src/index');

describe('POST /v1/payments', () => {
  it('returns 401 without an API key', async () => {
    const res = await request(app)
      .post('/v1/payments')
      .send({ amount: 5000, currency: 'USD', customerId: '22222222-0000-0000-0000-000000000001', paymentMethodId: 'pm_test' });

    expect(res.status).toBe(401);
  });

  it('returns 422 for invalid payload', async () => {
    const res = await request(app)
      .post('/v1/payments')
      .set('Authorization', 'Bearer ak_live_testkey')
      .send({ amount: 1 }); // too small, missing required fields

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('validation_error');
  });

  it('creates a payment and returns 201', async () => {
    const res = await request(app)
      .post('/v1/payments')
      .set('Authorization', 'Bearer ak_live_testkey')
      .send({
        amount: 5000,
        currency: 'USD',
        customerId: '22222222-0000-0000-0000-000000000001',
        paymentMethodId: 'pm_card_visa',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.status).toBe('succeeded');
  });
});

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
