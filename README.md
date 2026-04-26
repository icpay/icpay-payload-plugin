# ICPay Payload Plugin

`@ic-pay/payload-plugin-icpay` is a Payload CMS plugin that adds:

- ICPay server endpoints for creating and tracking payments
- Optional collections/globals for payment and webhook observability
- React widget helpers powered by `@ic-pay/icpay-widget` (payments, donations, topups)
- Optional bridge helpers for Payload ecommerce plugin payment hooks

This package is designed as a standalone GitHub/npm repository.

## Installation

```bash
pnpm add @ic-pay/payload-plugin-icpay
```

## Quick Start (Payload)

```ts
import { buildConfig } from 'payload';
import icpayPayloadPlugin from '@ic-pay/payload-plugin-icpay';

export default buildConfig({
  collections: [
    // your collections
  ],
  plugins: [
    icpayPayloadPlugin({
      enabled: true,
      sdk: {
        publishableKey: process.env.ICPAY_PUBLISHABLE_KEY!,
        secretKey: process.env.ICPAY_SECRET_KEY!,
        apiUrl: process.env.ICPAY_API_URL ?? 'https://api.icpay.org'
      },
      webhookSecret: process.env.ICPAY_WEBHOOK_SECRET,
      defaults: {
        fiatCurrency: 'USD'
      }
    })
  ]
});
```

## What This Plugin Adds

By default (`createCollections` and `createGlobalSettings` are `true`):

- Collection `icpay-payments`
- Collection `icpay-webhooks`
- Global `icpay-settings`
- Endpoints:
  - `POST /api/icpay/create-payment`
  - `POST /api/icpay/notify`
  - `POST /api/icpay/webhook`

## Endpoints

### `POST /api/icpay/create-payment`

Creates an ICPay payment via `@ic-pay/icpay-sdk`.

Example request:

```json
{
  "kind": "donation",
  "amountUsd": 15,
  "fiatCurrency": "USD",
  "description": "Support our project",
  "paymentMethod": "wallet",
  "metadata": {
    "campaign": "spring-2026"
  }
}
```

### `POST /api/icpay/webhook`

Receives ICPay webhook payloads and optionally checks the request signature with:

- `x-icpay-signature`
- or `x-icpay-webhook-signature`

If `webhookSecret` is set, one of those headers must match it.

## Widget Helpers (Frontend / Next.js)

This package re-exports React wrappers powered by `@ic-pay/icpay-widget`:

```tsx
import {
  IcpayPaymentWidget,
  IcpayDonationWidget,
  IcpayTopupWidget
} from '@ic-pay/payload-plugin-icpay/widgets';
```

Example:

```tsx
<IcpayDonationWidget
  publishableKey={process.env.NEXT_PUBLIC_ICPAY_PUBLISHABLE_KEY!}
  goalUsd={5000}
  defaultAmountUsd={25}
  metadata={{ page: 'donations' }}
/>
```

## Optional Payload Ecommerce Bridge

The bridge exposes generic hook handlers that you can map into your ecommerce integration:

```ts
import { createIcpayEcommerceBridge } from '@ic-pay/payload-plugin-icpay/commerce';

const bridge = createIcpayEcommerceBridge({
  enabled: true,
  sdk: {
    publishableKey: process.env.ICPAY_PUBLISHABLE_KEY!,
    secretKey: process.env.ICPAY_SECRET_KEY!,
    apiUrl: process.env.ICPAY_API_URL
  }
});

// attach bridge.beforeInitiatePayment / beforeConfirmOrder / afterConfirmOrder
// to your ecommerce payment hook pipeline
```

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
```

## Publish Checklist

- Update `package.json` repository/homepage/bugs URLs
- Tag the GitHub repository with `payload-plugin`
- Publish npm package:

```bash
npm publish --access public
```
