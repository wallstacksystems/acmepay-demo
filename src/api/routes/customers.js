const express = require('express');
const { requireApiKey, requireScope } = require('../middleware/auth');
const { standard } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const schemas = require('../../utils/validators');
const CustomerModel = require('../../models/customer');
const KycService = require('../../services/kyc.service');

const router = express.Router();

router.use(requireApiKey, standard);

router.post('/', requireScope('customers:write'), validate(schemas.createCustomer), async (req, res, next) => {
  try {
    const customer = await CustomerModel.create({ ...req.body, merchantId: req.merchant.id });
    // Kick off async KYC — don't block the response
    KycService.initiateVerification(customer.id).catch(() => {});
    res.status(201).json(customer);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'duplicate_customer', message: 'A customer with this email already exists.' });
    }
    next(err);
  }
});

router.get('/:id', requireScope('customers:read'), async (req, res, next) => {
  try {
    const customer = await CustomerModel.findById(req.params.id, req.merchant.id);
    if (!customer) {
      return res.status(404).json({ error: 'not_found', message: 'Customer not found.' });
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireScope('customers:write'), validate(schemas.updateCustomer), async (req, res, next) => {
  try {
    const customer = await CustomerModel.update(req.params.id, req.merchant.id, req.body);
    if (!customer) {
      return res.status(404).json({ error: 'not_found', message: 'Customer not found.' });
    }
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/payment-methods', requireScope('customers:read'), async (req, res, next) => {
  try {
    const methods = await CustomerModel.listPaymentMethods(req.params.id, req.merchant.id);
    res.json({ data: methods, count: methods.length });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/payment-methods/:pmId', requireScope('customers:write'), async (req, res, next) => {
  try {
    await CustomerModel.detachPaymentMethod(req.params.id, req.params.pmId, req.merchant.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get('/:id/kyc', requireScope('customers:read'), async (req, res, next) => {
  try {
    const status = await KycService.getStatus(req.params.id);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
