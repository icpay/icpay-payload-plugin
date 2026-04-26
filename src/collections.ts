import type { CollectionConfig, GlobalConfig } from 'payload';
import type { IcpayPluginOptions } from './types';

export const createIcpayPaymentsCollection = (
  options: IcpayPluginOptions,
  adminExtras?: { beforeListSyncButtonPath?: string }
): CollectionConfig => ({
  slug: options.collections?.payments ?? 'icpay-payments',
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

export const createIcpaySettingsGlobal = (): GlobalConfig => ({
  slug: 'icpay-settings',
  fields: [
    { name: 'publishableKey', type: 'text' },
    { name: 'secretKey', type: 'text' },
    { name: 'webhookSecret', type: 'text' },
    { name: 'apiUrl', type: 'text' },
    { name: 'defaultFiatCurrency', type: 'text' },
    { name: 'defaultRecipientAddress', type: 'text' }
  ]
});
