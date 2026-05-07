const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

const supabase = createClient(config.db.supabaseUrl, config.db.supabaseServiceKey);

// Signals and their weights that contribute to the composite risk score (0–100)
const SIGNAL_WEIGHTS = {
  velocityBreach: 40,
  highRiskCountry: 25,
  newCustomer: 10,
  highAmount: 15,
  unusualHour: 5,
  ipMismatch: 15,
};

async function evaluate({ merchantId, customerId, amount, currency, paymentMethodId, ip }) {
  const signals = {};
  let score = 0;

  const [velocity, customer] = await Promise.all([
    checkVelocity(merchantId, customerId),
    getCustomerMeta(customerId),
  ]);

  if (velocity.breached) {
    signals.velocityBreach = true;
    score += SIGNAL_WEIGHTS.velocityBreach;
    logger.warn({ event: 'fraud_velocity_breach', customerId, count: velocity.count });
  }

  if (customer && config.fraud.highRiskCountries.includes(customer.country)) {
    signals.highRiskCountry = true;
    score += SIGNAL_WEIGHTS.highRiskCountry;
  }

  const customerAgeHours = customer ? (Date.now() - new Date(customer.created_at).getTime()) / 3600000 : 0;
  if (customerAgeHours < 2) {
    signals.newCustomer = true;
    score += SIGNAL_WEIGHTS.newCustomer;
  }

  // Flag amounts > $5,000 for extra scrutiny
  if (amount > 500000) {
    signals.highAmount = true;
    score += SIGNAL_WEIGHTS.highAmount;
  }

  const hour = new Date().getUTCHours();
  if (hour >= 1 && hour <= 5) {
    signals.unusualHour = true;
    score += SIGNAL_WEIGHTS.unusualHour;
  }

  score = Math.min(score, 100);

  await recordAssessment({ merchantId, customerId, paymentMethodId, score, signals, ip, amount, currency });

  return {
    score,
    signals,
    blocked: score >= config.fraud.scoreThreshold,
    requiresReview: score >= 50 && score < config.fraud.scoreThreshold,
  };
}

async function checkVelocity(merchantId, customerId) {
  const windowStart = new Date(Date.now() - config.fraud.velocityWindowMinutes * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('merchant_id', merchantId)
    .eq('customer_id', customerId)
    .gte('created_at', windowStart)
    .in('status', ['succeeded', 'processing', 'pending']);

  return { count, breached: count >= config.fraud.maxTxnPerWindow };
}

async function getCustomerMeta(customerId) {
  const { data } = await supabase
    .from('customers')
    .select('country, created_at')
    .eq('id', customerId)
    .single();
  return data;
}

async function recordAssessment({ merchantId, customerId, paymentMethodId, score, signals, ip, amount, currency }) {
  await supabase.from('fraud_assessments').insert({
    merchant_id: merchantId,
    customer_id: customerId,
    payment_method_id: paymentMethodId,
    score,
    signals,
    ip_address: ip,
    amount,
    currency,
  });
}

module.exports = { evaluate };
