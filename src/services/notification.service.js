const sgMail = require('@sendgrid/mail');
const twilio = require('twilio');
const config = require('../config');
const logger = require('../utils/logger');
const CustomerModel = require('../models/customer');

sgMail.setApiKey(config.sendgrid.apiKey);
const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);

async function sendPaymentConfirmation(customerId, payment) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer?.email) {
    return;
  }

  const amount = (payment.amount / 100).toFixed(2);
  const currencyLabel = payment.currency.toUpperCase();

  await sgMail.send({
    to: customer.email,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    templateId: 'd-payment-confirmation-v2',
    dynamicTemplateData: {
      customerName: customer.firstName,
      amount,
      currency: currencyLabel,
      transactionId: payment.id,
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    },
  });

  logger.info({ event: 'email_sent', type: 'payment_confirmation', customerId, paymentId: payment.id });
}

async function sendPaymentFailureAlert(customerId, payment, failureReason) {
  const customer = await CustomerModel.findById(customerId);
  if (!customer?.email) {
    return;
  }

  await sgMail.send({
    to: customer.email,
    from: { email: config.sendgrid.fromEmail, name: config.sendgrid.fromName },
    templateId: 'd-payment-failure-v1',
    dynamicTemplateData: {
      customerName: customer.firstName,
      amount: (payment.amount / 100).toFixed(2),
      currency: payment.currency.toUpperCase(),
      reason: failureReason || 'Your payment could not be processed.',
    },
  });
}

async function sendSmsVerification(phoneNumber, code) {
  const message = await twilioClient.messages.create({
    body: `Your AcmePay verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
    from: config.twilio.phoneNumber,
    to: phoneNumber,
  });

  logger.info({ event: 'sms_sent', type: 'verification', smsSid: message.sid });
  return message.sid;
}

async function sendDisputeAlert(merchantId, transactionId, disputeReason) {
  logger.warn({ event: 'dispute_alert', merchantId, transactionId, disputeReason });
  // TODO(ops): wire to PagerDuty for high-value disputes once PD integration is set up
}

async function handleSmsStatus(smsSid, status) {
  if (status === 'failed' || status === 'undelivered') {
    logger.warn({ event: 'sms_delivery_failed', smsSid, status });
  }
}

module.exports = {
  sendPaymentConfirmation,
  sendPaymentFailureAlert,
  sendSmsVerification,
  sendDisputeAlert,
  handleSmsStatus,
};
