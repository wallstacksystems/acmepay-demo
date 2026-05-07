const express = require('express');
const { requireApiKey, requireScope } = require('../middleware/auth');
const { standard } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const schemas = require('../../utils/validators');
const TransactionModel = require('../../models/transaction');

const router = express.Router();

router.use(requireApiKey, standard);

router.get('/', requireScope('transactions:read'), validate(schemas.listTransactions, 'query'), async (req, res, next) => {
  try {
    const { customerId, status, from, to, limit, offset } = req.query;
    const result = await TransactionModel.list({
      merchantId: req.merchant.id,
      customerId,
      status,
      from,
      to,
      limit,
      offset,
    });
    res.json({
      data: result.rows,
      pagination: {
        total: result.total,
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireScope('transactions:read'), async (req, res, next) => {
  try {
    const txn = await TransactionModel.findById(req.params.id, req.merchant.id);
    if (!txn) {
      return res.status(404).json({ error: 'not_found', message: 'Transaction not found.' });
    }
    res.json(txn);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
