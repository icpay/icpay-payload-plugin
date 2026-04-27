import type { CollectionConfig, Field, GlobalConfig } from 'payload';
import type { IcpayPluginOptions } from './types';

const CLEAR_PAYMENTS_FIELD_PATH =
  '@ic-pay/payload-plugin-icpay/icpay-clear-payments#IcpayClearPaymentsSettingsButton' as const;

const WEBHOOK_HELP_FIELD_PATH =
  '@ic-pay/payload-plugin-icpay/icpay-webhook-help#IcpayWebhookEndpointHelp' as const;

export const createIcpayPaymentsCollection = (
  options: IcpayPluginOptions,
  adminExtras?: { beforeListSyncButtonPath?: string }
): CollectionConfig => ({
  slug: options.collections?.payments ?? 'icpay-payments',
  defaultSort: '-createdAt',
  // Source times from ICPay only (sync / webhook / API); not Payload ingest time.
  timestamps: false,
  admin: {
    useAsTitle: 'paymentIntentId',
    description:
      'Read-only payment records. Use “Sync payments from ICPay API” below or GET/POST /api/icpay/sync-payments.',
    ...(adminExtras?.beforeListSyncButtonPath
      ? {
          components: {
            beforeList: [adminExtras.beforeListSyncButtonPath]
          }
        }
      : {})
  },
  access: {
    read: () => true,
    create: () => false,
    update: () => false,
    delete: () => false
  },
  fields: [
    {
      name: 'createdAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Created time from ICPay (payment / intent), not when this row was saved in Payload.'
      }
    },
    {
      name: 'updatedAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Last update time from ICPay (payment / intent), not when this row was saved in Payload.'
      }
    },
    { name: 'kind', type: 'select', required: true, options: ['payment', 'donation', 'topup', 'custom'] },
    { name: 'status', type: 'text' },
    { name: 'amountUsd', type: 'number' },
    { name: 'fiatCurrency', type: 'text' },
    { name: 'paymentIntentId', type: 'text', required: true, index: true },
    { name: 'transactionId', type: 'number' },
    { name: 'checkoutUrl', type: 'text' },
    { name: 'metadata', type: 'json' },
    { name: 'source', type: 'select', options: ['webhook', 'sync', 'create-payment'], required: true, defaultValue: 'webhook' },
    { name: 'lastWebhookEventId', type: 'text', index: true },
    { name: 'raw', type: 'json' }
  ]
});

export const createIcpaySettingsGlobal = (opts?: {
  /** When false, omit the “clear payments” UI field (default: true). */
  clearPaymentsField?: boolean;
  /** When false, omit the inbound webhook URL / instructions block (default: true). */
  webhookEndpointHelpField?: boolean;
}): GlobalConfig => {
  const baseFields: Field[] = [
    { name: 'publishableKey', type: 'text' },
    { name: 'secretKey', type: 'text' },
    { name: 'apiUrl', type: 'text' },
    { name: 'defaultFiatCurrency', type: 'text' },
    { name: 'defaultRecipientAddress', type: 'text' }
  ];

  const fields: Field[] = [...baseFields];
  if (opts?.clearPaymentsField !== false) {
    fields.push({
      name: 'icpayClearPaymentsUi',
      type: 'ui',
      label: 'Payment records',
      admin: {
        components: {
          Field: CLEAR_PAYMENTS_FIELD_PATH
        }
      }
    });
  }

  if (opts?.webhookEndpointHelpField !== false) {
    fields.push({
      name: 'icpayWebhookEndpointHelpUi',
      type: 'ui',
      label: 'Inbound webhooks (ICPay → Payload)',
      admin: {
        components: {
          Field: WEBHOOK_HELP_FIELD_PATH
        }
      }
    });
  }

  return {
    slug: 'icpay-settings',
    fields
  };
};
