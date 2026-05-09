const stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');
const TransactionModel = require('../models/transaction');

const stripeClient = stripe(config.stripe.secretKey, { apiVersion: config.stripe.apiVersion });

async function create({ merchantId, amount, currency, customerId, paymentMethodId, description, metadata, captureMethod, statementDescriptor, riskScore }) {
  const idempotencyKey = uuidv4();

  const intent = await stripeClient.paymentIntents.create(
    {
      amount,
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirm: true,
      capture_method: captureMethod || 'automatic',
      description,
      statement_descriptor: statementDescriptor,
      metadata: { ...metadata, acmepay_customer_id: customerId, merchant_id: merchantId },
      return_url: `${config.apiBaseUrl}/v1/payments/return`,
    },
    { idempotencyKey }
  );

  const txn = await TransactionModel.create({
    id: uuidv4(),
    merchantId,
    customerId,
    stripePaymentIntentId: intent.id,
    amount,
    currency: currency.toUpperCase(),
    status: mapStripeStatus(intent.status),
    description,
    riskScore,
    metadata,
  });

  logger.info({ event: 'payment_created', transactionId: txn.id, stripeIntentId: intent.id, amount, currency });

  return txn;
}

async function getById(id, merchantId) {
  return TransactionModel.findById(id, merchantId);
}

async function capture(id, merchantId, captureAmount) {
  const txn = await TransactionModel.findById(id, merchantId);
  if (!txn) {
    throw Object.assign(new Error('Payment not found.'), { status: 404, code: 'not_found' });
  }
  if (txn.status !== 'requires_capture') {
    throw Object.assign(new Error('Payment is not in a capturable state.'), { status: 400, code: 'invalid_state' });
  }

  const intent = await stripeClient.paymentIntents.capture(txn.stripePaymentIntentId, {
    amount_to_capture: captureAmount,
  });

  return TransactionModel.updateStatus(id, mapStripeStatus(intent.status));
}

async function refund(id, merchantId, { amount, reason }) {
  const txn = await TransactionModel.findById(id, merchantId);
  if (!txn) {
    throw Object.assign(new Error('Payment not found.'), { status: 404, code: 'not_found' });
  }
  if (txn.status !== 'succeeded') {
    throw Object.assign(new Error('Only succeeded payments can be refunded.'), { status: 400, code: 'invalid_state' });
  }

  const refundObj = await stripeClient.refunds.create({
    payment_intent: txn.stripePaymentIntentId,
    amount,
    reason,
  });

  await TransactionModel.recordRefund(id, refundObj.id, refundObj.amount);

  logger.info({ event: 'payment_refunded', transactionId: id, refundId: refundObj.id, amount: refundObj.amount });
  return refundObj;
}

async function cancel(id, merchantId) {
  const txn = await TransactionModel.findById(id, merchantId);
  if (!txn) {
    throw Object.assign(new Error('Payment not found.'), { status: 404, code: 'not_found' });
  }

  const intent = await stripeClient.paymentIntents.cancel(txn.stripePaymentIntentId);
  return TransactionModel.updateStatus(id, mapStripeStatus(intent.status));
}

async function handleStripeSuccess(intent) {
  const txn = await TransactionModel.findByStripeId(intent.id);
  if (txn) {
    await TransactionModel.updateStatus(txn.id, 'succeeded');
  }
}

async function handleStripeFailure(intent) {
  const txn = await TransactionModel.findByStripeId(intent.id);
  if (txn) {
    await TransactionModel.updateStatus(txn.id, 'failed', {
      failureCode: intent.last_payment_error?.code,
      failureMessage: intent.last_payment_error?.message,
    });
  }
}

async function handleDispute(dispute) {
  const txn = await TransactionModel.findByStripeId(dispute.payment_intent);
  if (txn) {
    await TransactionModel.updateStatus(txn.id, 'disputed');
  }
}

function mapStripeStatus(stripeStatus) {
  const map = {
    succeeded: 'succeeded',
    processing: 'processing',
    requires_capture: 'requires_capture',
    requires_payment_method: 'failed',
    canceled: 'cancelled',
    requires_action: 'requires_action',
  };
  return map[stripeStatus] || 'pending';
}

module.exports = { create, getById, capture, refund, cancel, handleStripeSuccess, handleStripeFailure, handleDispute };
