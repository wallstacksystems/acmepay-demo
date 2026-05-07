const rateLimit = require('express-rate-limit');

const standard = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.merchant?.id || req.ip,
  message: { error: 'rate_limited', message: 'Too many requests. Please slow down.' },
});

// Tighter limit for payment creation to reduce card-testing abuse
const paymentCreate = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.merchant?.id || req.ip,
  message: { error: 'rate_limited', message: 'Payment creation rate limit exceeded.' },
});

const webhooks = rateLimit({
  windowMs: 10 * 1000,
  max: 500,
  keyGenerator: (req) => req.ip,
  message: { error: 'rate_limited' },
});

module.exports = { standard, paymentCreate, webhooks };
