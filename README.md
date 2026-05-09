# AcmePay API

AcmePay is a payments infrastructure platform for internet businesses. This repository contains the core API service that handles payment processing, customer management, fraud detection, and KYC verification.

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Database | Supabase (Postgres) |
| Payments | Stripe |
| SMS | Twilio |
| Email | SendGrid |
| Identity Verification | Persona |
| Fraud / AI | OpenAI GPT-4o-mini |
| Hosting | Render |

## Getting Started

### Prerequisites

- Node.js >= 20
- A Supabase project (free tier works for local dev)
- Stripe test-mode keys
- Twilio and SendGrid accounts (optional for local dev)

### Setup

```bash
git clone git@github.com:wallstacksystems/acmepay-demo.git
cd acmepay-demo
npm install
cp .env.example .env
# Fill in .env — see comments in that file
npm run migrate     # apply DB migrations
npm run dev         # starts on :3000 with hot-reload
```

### Running Tests

```bash
npm test              # all tests
npm run test:unit     # unit tests only
npm run test:coverage # with coverage report
```

## API Reference

All endpoints require an API key passed as `Authorization: Bearer ak_live_<key>`.

### Payments

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/v1/payments` | `payments:write` | Create a payment |
| `GET` | `/v1/payments/:id` | `payments:read` | Get payment status |
| `POST` | `/v1/payments/:id/capture` | `payments:write` | Capture an authorized payment |
| `POST` | `/v1/payments/:id/refund` | `payments:write` | Refund a payment |
| `POST` | `/v1/payments/:id/cancel` | `payments:write` | Cancel a payment |

### Customers

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/v1/customers` | `customers:write` | Create a customer |
| `GET` | `/v1/customers/:id` | `customers:read` | Get a customer |
| `PATCH` | `/v1/customers/:id` | `customers:write` | Update a customer |
| `GET` | `/v1/customers/:id/payment-methods` | `customers:read` | List saved payment methods |
| `DELETE` | `/v1/customers/:id/payment-methods/:pmId` | `customers:write` | Remove a payment method |
| `GET` | `/v1/customers/:id/kyc` | `customers:read` | Get KYC status |

### Transactions

| Method | Path | Scope | Description |
|---|---|---|---|
| `GET` | `/v1/transactions` | `transactions:read` | List transactions (filterable) |
| `GET` | `/v1/transactions/:id` | `transactions:read` | Get a transaction |

### Webhooks

Webhook endpoints are unauthenticated (verified by signature instead).

| Method | Path | Description |
|---|---|---|
| `POST` | `/v1/webhooks/stripe` | Stripe event handler |
| `POST` | `/v1/webhooks/twilio` | Twilio delivery status callback |

## Fraud Detection

Every payment is evaluated by the fraud engine before being sent to Stripe. The engine computes a risk score (0–100) from the following signals:

| Signal | Weight |
|---|---|
| Velocity breach (>10 txns/hr per customer) | 40 |
| High-risk country | 25 |
| High amount (>$5,000) | 15 |
| IP mismatch | 15 |
| New customer (<2 hours old) | 10 |
| Unusual hour (1–5 AM UTC) | 5 |

Payments with a score >= 75 are blocked. Scores 50–74 are flagged for manual review.

## Security & Compliance

- **PCI Scope**: Card numbers never touch this service — Stripe.js handles tokenization on the client.
- **Encryption**: Customer PII (date of birth) is AES-256-GCM encrypted at the application layer before writing to the database (`src/utils/crypto.js`).
- **Audit log**: All mutations are written to `audit_log`, which is protected against UPDATE/DELETE at the database level.
- **Rate limiting**: Payment creation is limited to 20 requests/minute per merchant to prevent card-testing attacks.
- **KYC/AML**: New customers are submitted to Persona for identity verification. Payments are not blocked on KYC status by default — configure `KYC_BLOCK_ON_PENDING=true` to enable.

## Project Structure

```
src/
  index.js                  Express entry point
  config.js                 Environment config
  api/
    routes/                 Route handlers
    middleware/             Auth, rate limiting, validation, error handling
  services/                 Business logic (payment, fraud, notification, KYC)
  models/                   Data access layer (Supabase)
  utils/                    Logger, crypto helpers, Joi schemas
db/
  migrations/               SQL migrations (run in order)
  seeds/                    Dev seed data
tests/
  unit/                     Unit tests (no I/O)
  integration/              Integration tests (mocked I/O)
.github/workflows/          CI and deploy pipelines
```

## Contributing

1. Branch from `main` using the pattern `feat/<short-description>` or `fix/<issue-number>`
2. Run `npm run lint` and `npm test` before pushing
3. All PRs require at least one approval and passing CI

## License

Proprietary — Copyright © 2024 AcmePay Inc. All rights reserved.
