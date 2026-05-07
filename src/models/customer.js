const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const stripe = require('stripe')(config.stripe.secretKey);

const supabase = createClient(config.db.supabaseUrl, config.db.supabaseServiceKey);

async function create({ merchantId, email, firstName, lastName, phone, dateOfBirth, address, metadata }) {
  const stripeCustomer = await stripe.customers.create({
    email,
    name: `${firstName} ${lastName}`,
    phone,
    metadata: { acmepay_merchant_id: merchantId },
  });

  const { data, error } = await supabase
    .from('customers')
    .insert({
      id: uuidv4(),
      merchant_id: merchantId,
      stripe_customer_id: stripeCustomer.id,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      date_of_birth: dateOfBirth,
      country: address?.country,
      address,
      metadata,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return formatCustomer(data);
}

async function findById(id, merchantId) {
  const query = supabase
    .from('customers')
    .select('*')
    .eq('id', id);

  if (merchantId) {
    query.eq('merchant_id', merchantId);
  }

  const { data } = await query.single();
  return data ? formatCustomer(data) : null;
}

async function update(id, merchantId, fields) {
  const updates = {};
  if (fields.email) { updates.email = fields.email; }
  if (fields.phone) { updates.phone = fields.phone; }
  if (fields.address) { updates.address = fields.address; updates.country = fields.address.country; }
  if (fields.metadata) { updates.metadata = fields.metadata; }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data ? formatCustomer(data) : null;
}

async function listPaymentMethods(customerId, merchantId) {
  const customer = await findById(customerId, merchantId);
  if (!customer) {
    return [];
  }

  const methods = await stripe.paymentMethods.list({
    customer: customer.stripeCustomerId,
    type: 'card',
  });

  return methods.data.map((pm) => ({
    id: pm.id,
    type: pm.type,
    card: {
      brand: pm.card.brand,
      last4: pm.card.last4,
      expMonth: pm.card.exp_month,
      expYear: pm.card.exp_year,
      funding: pm.card.funding,
    },
    created: pm.created,
  }));
}

async function detachPaymentMethod(customerId, paymentMethodId, merchantId) {
  const customer = await findById(customerId, merchantId);
  if (!customer) {
    throw Object.assign(new Error('Customer not found.'), { status: 404, code: 'not_found' });
  }

  await stripe.paymentMethods.detach(paymentMethodId);
}

function formatCustomer(row) {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    stripeCustomerId: row.stripe_customer_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    country: row.country,
    address: row.address,
    metadata: row.metadata,
    kycStatus: row.kyc_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = { create, findById, update, listPaymentMethods, detachPaymentMethod };
