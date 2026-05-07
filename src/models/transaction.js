const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(config.db.supabaseUrl, config.db.supabaseServiceKey);

async function create(txn) {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      id: txn.id,
      merchant_id: txn.merchantId,
      customer_id: txn.customerId,
      stripe_payment_intent_id: txn.stripePaymentIntentId,
      amount: txn.amount,
      currency: txn.currency,
      status: txn.status,
      description: txn.description,
      risk_score: txn.riskScore,
      metadata: txn.metadata,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return formatTransaction(data);
}

async function findById(id, merchantId) {
  const query = supabase.from('transactions').select('*').eq('id', id);
  if (merchantId) {
    query.eq('merchant_id', merchantId);
  }
  const { data } = await query.single();
  return data ? formatTransaction(data) : null;
}

async function findByStripeId(stripePaymentIntentId) {
  const { data } = await supabase
    .from('transactions')
    .select('*')
    .eq('stripe_payment_intent_id', stripePaymentIntentId)
    .single();
  return data ? formatTransaction(data) : null;
}

async function list({ merchantId, customerId, status, from, to, limit = 20, offset = 0 }) {
  let query = supabase
    .from('transactions')
    .select('*', { count: 'exact' })
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (customerId) { query = query.eq('customer_id', customerId); }
  if (status) { query = query.eq('status', status); }
  if (from) { query = query.gte('created_at', from); }
  if (to) { query = query.lte('created_at', to); }

  const { data, count, error } = await query;
  if (error) {
    throw error;
  }

  return { rows: (data || []).map(formatTransaction), total: count || 0 };
}

async function updateStatus(id, status, extra = {}) {
  const updates = { status, updated_at: new Date().toISOString(), ...extra };
  const { data, error } = await supabase
    .from('transactions')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return formatTransaction(data);
}

async function recordRefund(transactionId, stripeRefundId, refundAmount) {
  await supabase.from('refunds').insert({
    transaction_id: transactionId,
    stripe_refund_id: stripeRefundId,
    amount: refundAmount,
  });
  // Update the transaction status only if fully refunded — partial refunds keep 'succeeded'
}

function formatTransaction(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    description: row.description,
    riskScore: row.risk_score,
    failureCode: row.failure_code,
    failureMessage: row.failure_message,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { create, findById, findByStripeId, list, updateStatus, recordRefund };
