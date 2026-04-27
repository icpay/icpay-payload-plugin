import type { Block, Field } from 'payload';

/**
 * Lexical block + optional standalone `blocks` field — insert payment / donation / top-up
 * widgets in rich text (via {@link icpayWidgetBlocksFeature}) or as top-level blocks.
 *
 * Keys, API URL, and default fiat come from Globals → `icpay-settings` at render time
 * (see {@link IcpayRichText} / your own `RichText` converters).
 */
export const icpayWidgetBlock: Block = {
  slug: 'icpayWidget',
  labels: {
    singular: 'ICPay Widget',
    plural: 'ICPay Widgets'
  },
  fields: [
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'payment',
      options: [
        { label: 'Payment', value: 'payment' },
        { label: 'Donation', value: 'donation' },
        { label: 'Top Up', value: 'topup' }
      ]
    },
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
    {
      name: 'recipientAddress',
      type: 'text',
      admin: {
        description:
          'Optional. If empty, the default recipient from Globals → icpay-settings is used when configured.'
      }
    },
    {
      name: 'metadata',
      type: 'array',
      labels: { singular: 'Metadata row', plural: 'Metadata' },
      admin: {
        description:
          'Optional key–value pairs sent with checkout (like WordPress / WooCommerce custom fields). Add rows dynamically; no raw JSON.',
        initCollapsed: true
      },
      fields: [
        {
          name: 'key',
          type: 'text',
          required: true,
          admin: { placeholder: 'e.g. campaign_id' }
        },
        {
          name: 'value',
          type: 'textarea',
          admin: { placeholder: 'e.g. spring-2026', rows: 2 }
        }
      ]
    },
    {
      name: 'allowedTokenShortcodes',
      type: 'array',
      labels: { singular: 'Allowed token', plural: 'Filter allowed tokens (optional)' },
      admin: {
        description:
          'Optional. Add ledger shortcodes (e.g. icp, ckbtc) to limit which tokens visitors can pay with. Leave empty to offer every supported token — same as the WordPress ICPay block “Filter allowed tokens”.',
        initCollapsed: true
      },
      fields: [
        {
          name: 'tokenShortcode',
          type: 'text',
          required: true,
          admin: { placeholder: 'e.g. icp' }
        }
      ]
    },
    {
      name: 'amountUsd',
      type: 'number',
      defaultValue: 1,
      admin: {
        condition: (_, siblingData) => siblingData?.mode === 'payment'
      }
    },
    {
      name: 'goalUsd',
      type: 'number',
      admin: {
        condition: (_, siblingData) => siblingData?.mode === 'donation'
      }
    },
    {
      name: 'defaultAmountUsd',
      type: 'number',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.mode === 'donation' || siblingData?.mode === 'topup'
      }
    },
    {
      name: 'minUsd',
      type: 'number',
      admin: {
        condition: (_, siblingData) => siblingData?.mode === 'topup'
      }
    },
    {
      name: 'maxUsd',
      type: 'number',
      admin: {
        condition: (_, siblingData) => siblingData?.mode === 'topup'
      }
    },
    {
      name: 'buttonLabel',
      type: 'text',
      defaultValue: 'Pay with icpay'
    }
  ]
};

/**
 * Reusable Payload `blocks` field (outside Lexical) using the same shape as the Lexical block.
 */
export const createIcpayWidgetsField = (name = 'icpayWidgets'): Field => ({
  name,
  label: 'ICPay Widgets',
  type: 'blocks',
  blocks: [icpayWidgetBlock],
  admin: {
    description:
      'ICPay widgets as separate blocks. Prefer inserting **ICPay Widget** inside **rich text** when you want inline placement (see plugin subpath `@ic-pay/payload-plugin-icpay/lexical`).'
  }
});
