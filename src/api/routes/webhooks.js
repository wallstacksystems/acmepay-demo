const express = require('express');
const stripe = require('stripe');
const config = require('../../config');
const logger = require('../../utils/logger');
const PaymentService = require('../../services/payment.service');
const NotificationService = require('../../services/notification.service');
const { webhooks: webhookRateLimit } = require('../middleware/rateLimit');

const stripeClient = stripe(config.stripe.secretKey);
const router = express.Router();

router.use(webhookRateLimit);

router.post('/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.warn({ event: 'stripe_webhook_sig_failure', err: err.message });
    return res.status(400).json({ error: 'invalid_signature' });
  }

  logger.info({ event: 'stripe_webhook_received', type: event.type, id: event.id });

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await PaymentService.handleStripeSuccess(event.data.object);
        break;

      case 'payment_intent.payment_failed':
        await PaymentService.handleStripeFailure(event.data.object);
        break;

      case 'charge.dispute.created':
        await PaymentService.handleDispute(event.data.object);
        logger.warn({ event: 'dispute_created', chargeId: event.data.object.charge });
        break;

      case 'customer.subscription.deleted':
        // Handled by billing service — not in scope for this service
        break;

      default:
        logger.debug({ event: 'stripe_webhook_unhandled', type: event.type });
    }
  } catch (err) {
    logger.error({ event: 'stripe_webhook_handler_error', type: event.type, err });
    // Return 200 anyway to prevent Stripe from retrying indefinitely for handler bugs.
    // Real failures that need retry should re-throw before this catch.
  }

  res.json({ received: true });
});

router.post('/twilio', express.urlencoded({ extended: false }), async (req, res) => {
  const { MessageStatus, SmsSid } = req.body;

  if (!SmsSid) {
    return res.status(400).end();
  }

  logger.info({ event: 'twilio_status_update', smsSid: SmsSid, status: MessageStatus });

  await NotificationService.handleSmsStatus(SmsSid, MessageStatus).catch((err) =>
    logger.error({ event: 'twilio_handler_error', err })
  );

  res.status(204).end();
});

module.exports = router;
