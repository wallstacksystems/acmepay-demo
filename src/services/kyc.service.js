const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const logger = require('../utils/logger');

const supabase = createClient(config.db.supabaseUrl, config.db.supabaseServiceKey);

// AcmePay uses Persona for identity verification. This service wraps their API
// and persists verification state locally so we don't need to call Persona on every check.
const PERSONA_API = 'https://withpersona.com/api/v1';

async function initiateVerification(customerId) {
  const { data: existing } = await supabase
    .from('kyc_verifications')
    .select('id, status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existing && ['pending', 'approved'].includes(existing.status)) {
    return existing;
  }

  // In production this calls Persona's /inquiries endpoint.
  // During development we stub with a pending record.
  const { data: verification, error } = await supabase
    .from('kyc_verifications')
    .insert({
      customer_id: customerId,
      status: 'pending',
      provider: 'persona',
    })
    .select()
    .single();

  if (error) {
    logger.error({ event: 'kyc_insert_error', customerId, error });
    throw error;
  }

  logger.info({ event: 'kyc_initiated', customerId, verificationId: verification.id });
  return verification;
}

async function getStatus(customerId) {
  const { data, error } = await supabase
    .from('kyc_verifications')
    .select('id, status, provider, created_at, completed_at, failure_reason')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { status: 'not_started' };
  }

  return data;
}

async function handleWebhook(payload) {
  const { inquiry_id: inquiryId, status, attributes } = payload.data;

  const kycStatus = mapPersonaStatus(status);

  await supabase
    .from('kyc_verifications')
    .update({
      status: kycStatus,
      completed_at: kycStatus !== 'pending' ? new Date().toISOString() : null,
      failure_reason: attributes?.failed_reason || null,
      raw_payload: payload,
    })
    .eq('provider_inquiry_id', inquiryId);

  logger.info({ event: 'kyc_updated', inquiryId, status: kycStatus });
}

function mapPersonaStatus(personaStatus) {
  const map = {
    completed: 'approved',
    failed: 'rejected',
    expired: 'expired',
    pending: 'pending',
  };
  return map[personaStatus] || 'pending';
}

module.exports = { initiateVerification, getStatus, handleWebhook };
