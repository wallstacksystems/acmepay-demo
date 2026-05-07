const express = require('express');
const { requireApiKey, requireScope } = require('../middleware/auth');
const { standard, paymentCreate } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const schemas = require('../../utils/validators');
const PaymentService = require('../../services/payment.service');
const FraudService = require('../../services/fraud.service');
const NotificationService = require('../../services/notification.service');
const logger = require('../../utils/logger');

const router = express.Router();

router.use(requireApiKey);
router.use(standard);

router.post('/', paymentCreate, requireScope('payments:write'), validate(schemas.createPayment), async (req, res, next) => {
  try {
    const { amount, currency, customerId, paymentMethodId, description, metadata, captureMethod, statementDescriptor } = req.body;

    const riskAssessment = await FraudService.evaluate({
      merchantId: req.merchant.id,
      customerId,
      amount,
      currency,
      paymentMethodId,
      ip: req.ip,
    });

    if (riskAssessment.blocked) {
      logger.warn({ event: 'payment_blocked', customerId, score: riskAssessment.score });
      return res.status(402).json({
        error: 'payment_declined',
        code: 'fraud_risk',
        message: 'Payment declined due to elevated risk.',
        riskScore: riskAssessment.score,
      });
    }

    const payment = await PaymentService.create({
      merchantId: req.merchant.id,
      amount,
      currency,
      customerId,
      paymentMethodId,
      description,
      metadata,
      captureMethod,
      statementDescriptor,
      riskScore: riskAssessment.score,
    });

    if (payment.status === 'succeeded' || payment.status === 'processing') {
      NotificationService.sendPaymentConfirmation(customerId, payment).catch((err) =>
        logger.error({ event: 'notification_failed', paymentId: payment.id, err })
      );
    }

    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireScope('payments:read'), async (req, res, next) => {
  try {
    const payment = await PaymentService.getById(req.params.id, req.merchant.id);
    if (!payment) {
      return res.status(404).json({ error: 'not_found', message: 'Payment not found.' });
    }
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/capture', requireScope('payments:write'), async (req, res, next) => {
  try {
    const payment = await PaymentService.capture(req.params.id, req.merchant.id, req.body.amount);
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/refund', requireScope('payments:write'), validate(schemas.refundPayment), async (req, res, next) => {
  try {
    const refund = await PaymentService.refund(req.params.id, req.merchant.id, req.body);
    res.json(refund);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireScope('payments:write'), async (req, res, next) => {
  try {
    const payment = await PaymentService.cancel(req.params.id, req.merchant.id);
    res.json(payment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
