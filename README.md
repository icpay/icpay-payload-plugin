# ICPay Payload Plugin

`@ic-pay/payload-plugin-icpay` is a Payload CMS plugin that adds:

- ICPay server endpoints for creating and tracking payments
- Read-only `icpay-payments` storage populated by webhook/sync (not manual admin creation)
- Global settings for API URL + publishable/secret/webhook keys
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
      // Optional: `sdk` env defaults; otherwise configure Admin → Globals → icpay-settings.
      // sdk: { publishableKey: '...', secretKey: '...', apiUrl: 'https://api.icpay.org' },
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
- Global `icpay-settings`
- Endpoints:
  - `POST /api/icpay/create-payment`
  - `POST /api/icpay/sync-payments`
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

### `POST /api/icpay/sync-payments`

Pulls payments from icpay-api and upserts into `icpay-payments`.

Defaults:

- path: **`/sdk/payments`** (icpay-api `SdkPaymentsController`, secret key bearer — plain `fetch`, not the JS SDK)
- auth: `Authorization: Bearer <secretKey>` from Globals → icpay-settings (or plugin `sdk`)
- source flag in DB: `sync`

You can override sync behavior with plugin option:

```ts
sync: {
  endpointPath: '/sdk/payments',
  method: 'GET',
  limit: 100 // optional `?limit=` for non–icpay-api backends
}
```

### `POST /api/icpay/webhook`

Receives ICPay webhook payloads and optionally checks the request signature with:

- `x-icpay-signature`
- or `x-icpay-webhook-signature`

If `webhookSecret` is set, one of those headers must match it.
Webhook confirmations are upserted directly into `icpay-payments` (`source: webhook`).

## Admin behavior

- `icpay-payments` is read-only from admin (`create/update/delete` disabled)
- no separate webhook collection is created
- **Sync button** (default on): above the payments list, calls `POST /api/icpay/sync-payments` with the admin session and refreshes the list. The component is exposed as the package subpath `@ic-pay/payload-plugin-icpay/icpay-sync-payments` (not a filesystem path) so `payload generate:importmap` and Next resolve it in Docker and locally. Requires `next`, `@payloadcms/ui`, and `transpilePackages: ['@ic-pay/payload-plugin-icpay']` in `next.config`.
- **Clear payments** (default on): on **Globals → icpay-settings**, a danger-zone control calls `POST /api/icpay/clear-payments` (admin session) to delete every document in `icpay-payments`, with browser confirm + on-screen warning. Subpath: `@ic-pay/payload-plugin-icpay/icpay-clear-payments`.
- use the sync endpoint (or your own scheduler) to pull historical records from icpay-api

Configure **publishable key, secret key, API URL, webhook secret** in **Globals → icpay-settings**. Optional plugin `sdk` values merge as fallbacks when a global field is empty.

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
