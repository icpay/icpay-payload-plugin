import type { CollectionConfig, GlobalConfig } from 'payload';
import type { IcpayPluginOptions } from './types';

export const createIcpayPaymentsCollection = (options: IcpayPluginOptions): CollectionConfig => ({
  slug: options.collections?.payments ?? 'icpay-payments',
  admin: {
    useAsTitle: 'paymentIntentId'
  },
  access: {
    read: () => true
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
    { name: 'raw', type: 'json' }
  ]
});

export const createIcpayWebhooksCollection = (options: IcpayPluginOptions): CollectionConfig => ({
  slug: options.collections?.webhooks ?? 'icpay-webhooks',
  admin: {
    useAsTitle: 'eventType'
  },
  access: {
    read: () => true
  },
  fields: [
    { name: 'eventType', type: 'text', required: true, index: true },
    { name: 'eventId', type: 'text', index: true },
    { name: 'paymentIntentId', type: 'text', index: true },
    { name: 'signature', type: 'text' },
    { name: 'payload', type: 'json', required: true }
  ]
});

export const createIcpaySettingsGlobal = (): GlobalConfig => ({
  slug: 'icpay-settings',
  fields: [
    { name: 'publishableKey', type: 'text' },
    { name: 'apiUrl', type: 'text' },
    { name: 'defaultFiatCurrency', type: 'text' },
    { name: 'defaultRecipientAddress', type: 'text' }
  ]
});
