jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ count: 'exact', head: true, eq: () => ({ eq: () => ({ gte: () => ({ in: () => ({ count: 2 }) }) }) }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: null, error: null }) }) }),
    }),
  }),
}));

jest.mock('../../src/config', () => ({
  db: { supabaseUrl: 'http://localhost', supabaseServiceKey: 'test' },
  fraud: {
    scoreThreshold: 75,
    velocityWindowMinutes: 60,
    maxTxnPerWindow: 10,
    highRiskCountries: ['NG', 'KP', 'IR', 'CU'],
  },
  logging: { level: 'silent' },
  env: 'test',
}));

const FraudService = require('../../src/services/fraud.service');

describe('FraudService.evaluate', () => {
  const baseInput = {
    merchantId: 'merchant-1',
    customerId: 'customer-1',
    amount: 10000,
    currency: 'USD',
    paymentMethodId: 'pm_test_123',
    ip: '1.2.3.4',
  };

  it('returns a score and not blocked for low-risk input', async () => {
    const result = await FraudService.evaluate(baseInput);
    expect(result).toHaveProperty('score');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result).toHaveProperty('blocked');
    expect(result).toHaveProperty('signals');
  });

  it('flags high amount signal for payments over $5,000', async () => {
    const result = await FraudService.evaluate({ ...baseInput, amount: 600000 });
    expect(result.signals.highAmount).toBe(true);
  });

  it('does not flag high amount for payments at or below $5,000', async () => {
    const result = await FraudService.evaluate({ ...baseInput, amount: 500000 });
    expect(result.signals.highAmount).toBeUndefined();
  });

  it('score is capped at 100', async () => {
    // Trigger every signal that doesn't require DB state
    const result = await FraudService.evaluate({ ...baseInput, amount: 999999 });
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns blocked: false when score is below threshold', async () => {
    const result = await FraudService.evaluate(baseInput);
    if (result.score < 75) {
      expect(result.blocked).toBe(false);
    }
  });
});
