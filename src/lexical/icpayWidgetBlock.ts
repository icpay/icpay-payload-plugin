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
    { name: 'metadata', type: 'json' },
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
