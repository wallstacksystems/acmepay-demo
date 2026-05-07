const Joi = require('joi');

const currency = Joi.string().uppercase().length(3);
const phone = Joi.string().pattern(/^\+[1-9]\d{7,14}$/);

const schemas = {
  createPayment: Joi.object({
    amount: Joi.number().integer().min(50).max(100000000).required(),
    currency: currency.required(),
    customerId: Joi.string().uuid().required(),
    paymentMethodId: Joi.string().required(),
    description: Joi.string().max(500),
    metadata: Joi.object().max(20),
    captureMethod: Joi.string().valid('automatic', 'manual').default('automatic'),
    statementDescriptor: Joi.string().max(22),
  }),

  refundPayment: Joi.object({
    amount: Joi.number().integer().min(1),
    reason: Joi.string().valid('duplicate', 'fraudulent', 'requested_by_customer').required(),
  }),

  createCustomer: Joi.object({
    email: Joi.string().email().required(),
    firstName: Joi.string().min(1).max(100).required(),
    lastName: Joi.string().min(1).max(100).required(),
    phone: phone,
    dateOfBirth: Joi.string().isoDate(),
    address: Joi.object({
      line1: Joi.string().max(200).required(),
      line2: Joi.string().max(200),
      city: Joi.string().max(100).required(),
      state: Joi.string().max(100),
      postalCode: Joi.string().max(20).required(),
      country: Joi.string().length(2).uppercase().required(),
    }),
    metadata: Joi.object().max(10),
  }),

  updateCustomer: Joi.object({
    email: Joi.string().email(),
    phone: phone,
    address: Joi.object({
      line1: Joi.string().max(200),
      line2: Joi.string().max(200),
      city: Joi.string().max(100),
      state: Joi.string().max(100),
      postalCode: Joi.string().max(20),
      country: Joi.string().length(2).uppercase(),
    }),
    metadata: Joi.object().max(10),
  }).min(1),

  listTransactions: Joi.object({
    customerId: Joi.string().uuid(),
    status: Joi.string().valid('pending', 'succeeded', 'failed', 'refunded'),
    from: Joi.string().isoDate(),
    to: Joi.string().isoDate(),
    limit: Joi.number().integer().min(1).max(100).default(20),
    offset: Joi.number().integer().min(0).default(0),
  }),
};

module.exports = schemas;
