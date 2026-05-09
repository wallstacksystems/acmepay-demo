const logger = require('../../utils/logger');

function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: `No route found for ${req.method} ${req.path}` });
}

function errorHandler(err, req, res, _next) {
  logger.error({ err, path: req.path, method: req.method });

  if (err.type === 'StripeInvalidRequestError') {
    return res.status(400).json({ error: 'payment_error', message: err.message });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.code || 'error', message: err.message });
  }

  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
}

module.exports = { notFound, errorHandler };
