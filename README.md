# ICPay Payload Plugin

`@ic-pay/payload-plugin-icpay` is a Payload CMS plugin that adds:

- ICPay server endpoints for creating and tracking payments
- Read-only `icpay-payments` storage populated by webhook/sync (not manual admin creation)
- Global settings for API URL + publishable/secret keys
- React widget helpers powered by `@ic-pay/icpay-widget` (payments, donations, topups)
- Optional **Lexical** rich-text integration: insert **ICPay Widget** blocks inline (subpath `@ic-pay/payload-plugin-icpay/lexical`) and render them with `@ic-pay/payload-plugin-icpay/lexical-react`
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

## Lexical rich text (inline widget blocks)

Requires `@payloadcms/richtext-lexical` (same major as your Payload app, e.g. `^3.82`).

**1. Admin — enable the block on your `richText` field** (same idea as WordPress “insert block”):

```ts
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { icpayWidgetBlocksFeature } from '@ic-pay/payload-plugin-icpay/lexical';

{
  name: 'content',
  type: 'richText',
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [...defaultFeatures, icpayWidgetBlocksFeature()],
  }),
}
```

Optional: add a standalone `blocks` field elsewhere using `createIcpayWidgetsField()` from the same subpath.

Each **ICPay Widget** block includes **Metadata** as repeatable **key / value** rows (Payload `array` field), not a raw JSON textarea—similar to WordPress-style meta. Rows are merged into one object for checkout. Legacy blocks that still store metadata as a JSON object are supported at render time (`normalizeWidgetMetadata`).

**Filter allowed tokens (optional)** matches the WordPress block: an array of rows, each with a **token shortcode** (e.g. `icp`, `ckbtc`). When the list is empty, every supported token is offered (`tokenShortcodes` is omitted from the widget config). Helpers: `normalizeAllowedTokenShortcodes` on `@ic-pay/payload-plugin-icpay/lexical` (and re-exported from `lexical-react`).

**2. Frontend — render Lexical JSON and map embedded widgets** (e.g. Next.js App Router):

The `lexical-react` entry is a **Client Component** (`'use client'`), because `@payloadcms/richtext-lexical/react`’s `RichText` uses client hooks. You may import `IcpayRichText` from a **Server Component** (e.g. a `page.tsx`); Next will render it as a client boundary.

```tsx
import { IcpayRichText } from '@ic-pay/payload-plugin-icpay/lexical-react';

<IcpayRichText
  data={page.content}
  widgetDefaults={{
    publishableKey: settings?.publishableKey,
    apiUrl: settings?.apiUrl,
    fiatCurrency: settings?.defaultFiatCurrency,
    defaultRecipientAddress: settings?.defaultRecipientAddress,
  }}
/>
```

Use a CSS class on the wrapper via `className` (default `cms-rich-text`) for typography.

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

Webhook signatures are validated against **secretKey** (from **icpay-settings** or plugin `sdk.secretKey`). The `x-icpay-signature` / `x-icpay-webhook-signature` header must exactly equal that secret key, otherwise Payload returns `401`. If `secretKey` is missing, webhook endpoint returns `400`.

Webhook confirmations are upserted directly into `icpay-payments` (`source: webhook`).

**Admin:** Globals → **icpay-settings** ends with an **Inbound webhooks** block showing the full webhook URL (from `serverURL` + `/api` + `apiBasePath` + `/webhook`). Override the path segment with `NEXT_PUBLIC_ICPAY_API_BASE` in the Next app if you change `apiBasePath` from `/icpay`.

## Admin behavior

- `icpay-payments` is read-only from admin (`create/update/delete` disabled). Collection **`timestamps: false`**: `createdAt` / `updatedAt` are explicit date fields filled only from ICPay API / webhook payloads (payment + intent + transaction), not Payload ingest time.
- no separate webhook collection is created
- **Sync button** (default on): above the payments list, calls `POST /api/icpay/sync-payments` with the admin session and refreshes the list. The component is exposed as the package subpath `@ic-pay/payload-plugin-icpay/icpay-sync-payments` (not a filesystem path) so `payload generate:importmap` and Next resolve it in Docker and locally. Requires `next`, `@payloadcms/ui`, and `transpilePackages: ['@ic-pay/payload-plugin-icpay']` in `next.config`.
- **Clear payments** (default on): **Globals → icpay-settings** includes a `ui` field with a normal button that calls `POST /api/icpay/clear-payments` (admin session) after a browser `confirm()` explaining the impact. Subpath: `@ic-pay/payload-plugin-icpay/icpay-clear-payments`.
- **Webhook URL help** (default on): last block on **icpay-settings** shows the POST URL for icpay-api and how `x-icpay-signature` / `x-icpay-webhook-signature` relate to **secretKey**. Subpath: `@ic-pay/payload-plugin-icpay/icpay-webhook-help`.
- use the sync endpoint (or your own scheduler) to pull historical records from icpay-api

Configure **publishable key, secret key, API URL** in **Globals → icpay-settings**. Optional plugin `sdk` values merge as fallbacks when a global field is empty.

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
