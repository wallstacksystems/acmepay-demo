const winston = require('winston');
const config = require('../config');

const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    config.env === 'production'
      ? winston.format.json()
      : winston.format.prettyPrint()
  ),
  defaultMeta: { service: 'acmepay-api' },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
