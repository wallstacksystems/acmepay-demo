const required = (name) => {
  const val = process.env[name];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return val || '';
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiry: process.env.JWT_EXPIRY || '15m',
    refreshSecret: required('REFRESH_TOKEN_SECRET'),
    apiKeySalt: required('API_KEY_SALT'),
  },

  db: {
    url: required('DATABASE_URL'),
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    supabaseAnonKey: required('SUPABASE_ANON_KEY'),
  },

  stripe: {
    secretKey: required('STRIPE_SECRET_KEY'),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: required('STRIPE_WEBHOOK_SECRET'),
    apiVersion: process.env.STRIPE_API_VERSION || '2024-04-10',
  },

  twilio: {
    accountSid: required('TWILIO_ACCOUNT_SID'),
    authToken: required('TWILIO_AUTH_TOKEN'),
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
  },

  sendgrid: {
    apiKey: required('SENDGRID_API_KEY'),
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'noreply@acmepay.io',
    fromName: process.env.SENDGRID_FROM_NAME || 'AcmePay',
  },

  openai: {
    apiKey: required('OPENAI_API_KEY'),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  },

  encryption: {
    key: required('ENCRYPTION_KEY'),
    iv: required('ENCRYPTION_IV'),
  },

  storage: {
    piiBucket: process.env.CUSTOMER_PII_BUCKET || 'acmepay-customer-pii-dev',
    region: process.env.AWS_REGION || 'us-east-1',
  },

  fraud: {
    scoreThreshold: parseInt(process.env.FRAUD_SCORE_THRESHOLD || '75', 10),
    velocityWindowMinutes: parseInt(process.env.VELOCITY_WINDOW_MINUTES || '60', 10),
    maxTxnPerWindow: parseInt(process.env.MAX_TXN_PER_WINDOW || '10', 10),
    highRiskCountries: (process.env.HIGH_RISK_COUNTRIES || 'NG,KP,IR,CU').split(','),
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    sentryDsn: process.env.SENTRY_DSN || '',
  },
};

module.exports = config;
