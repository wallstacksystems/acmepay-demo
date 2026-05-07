require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./api/middleware/errorHandler');

const paymentsRouter = require('./api/routes/payments');
const customersRouter = require('./api/routes/customers');
const transactionsRouter = require('./api/routes/transactions');
const webhooksRouter = require('./api/routes/webhooks');

const app = express();

app.use(helmet());
app.use(cors({ origin: config.env === 'production' ? 'https://dashboard.acmepay.io' : '*' }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Raw body required for Stripe webhook signature verification
app.use('/v1/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.4.1', env: config.env });
});

app.use('/v1/payments', paymentsRouter);
app.use('/v1/customers', customersRouter);
app.use('/v1/transactions', transactionsRouter);
app.use('/v1/webhooks', webhooksRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  logger.info(`AcmePay API running on port ${config.port} [${config.env}]`);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down gracefully');
  server.close(() => process.exit(0));
});

module.exports = app;
