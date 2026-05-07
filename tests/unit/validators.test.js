const schemas = require('../../src/utils/validators');

describe('createPayment schema', () => {
  const valid = {
    amount: 5000,
    currency: 'USD',
    customerId: '123e4567-e89b-12d3-a456-426614174000',
    paymentMethodId: 'pm_test_abc',
  };

  it('passes valid input', () => {
    const { error } = schemas.createPayment.validate(valid);
    expect(error).toBeUndefined();
  });

  it('rejects amount below minimum', () => {
    const { error } = schemas.createPayment.validate({ ...valid, amount: 10 });
    expect(error).toBeDefined();
    expect(error.details[0].path).toContain('amount');
  });

  it('rejects invalid currency', () => {
    const { error } = schemas.createPayment.validate({ ...valid, currency: 'USDD' });
    expect(error).toBeDefined();
  });

  it('requires customerId', () => {
    const { error } = schemas.createPayment.validate({ ...valid, customerId: undefined });
    expect(error).toBeDefined();
  });
});

describe('createCustomer schema', () => {
  const valid = {
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    address: { line1: '123 Main St', city: 'Springfield', postalCode: '12345', country: 'US' },
  };

  it('passes valid input', () => {
    const { error } = schemas.createCustomer.validate(valid);
    expect(error).toBeUndefined();
  });

  it('rejects invalid email', () => {
    const { error } = schemas.createCustomer.validate({ ...valid, email: 'not-an-email' });
    expect(error).toBeDefined();
  });

  it('rejects country code longer than 2 chars', () => {
    const { error } = schemas.createCustomer.validate({
      ...valid,
      address: { ...valid.address, country: 'USA' },
    });
    expect(error).toBeDefined();
  });
});
