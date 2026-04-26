import Icpay, { type CreateTransactionRequest, type IcpayConfig } from '@ic-pay/icpay-sdk';
import type { IcpayCheckoutInput, IcpayPluginOptions } from './types';

export type MergedIcpaySdk = Pick<IcpayConfig, 'publishableKey' | 'secretKey' | 'apiUrl' | 'icHost' | 'debug'>;

/**
 * Merge plugin `sdk` option (e.g. env defaults) with `icpay-settings` global (admin).
 * Global fields win when non-empty strings.
 */
const firstNonEmpty = (...vals: unknown[]): string => {
  for (const v of vals) {
    if (v != null && String(v).trim() !== '') return String(v);
  }
  return '';
};

export const mergeSdkFromSettings = (
  options: IcpayPluginOptions,
  settings?: Record<string, unknown> | null
): MergedIcpaySdk => {
  const o = options.sdk ?? {};
  const s = settings ?? {};
  return {
    publishableKey: firstNonEmpty(s.publishableKey, o.publishableKey),
    secretKey: firstNonEmpty(s.secretKey, o.secretKey),
    apiUrl: firstNonEmpty(s.apiUrl, o.apiUrl),
    icHost: o.icHost,
    debug: Boolean(o.debug ?? false)
  };
};

export const buildIcpayConfig = (merged: MergedIcpaySdk): IcpayConfig => ({
  publishableKey: merged.publishableKey,
  secretKey: merged.secretKey,
  apiUrl: merged.apiUrl,
  icHost: merged.icHost,
  debug: merged.debug ?? false
});

export const toCreateTransactionRequest = (
  input: IcpayCheckoutInput,
  options: IcpayPluginOptions
): CreateTransactionRequest => {
  if (options.mapCheckoutToIcpayRequest) {
    return options.mapCheckoutToIcpayRequest(input);
  }

  const paymentMethod = input.paymentMethod ?? 'wallet';
  const metadata = {
    ...(options.defaults?.metadata ?? {}),
    ...(input.metadata ?? {}),
    icpay_plugin: 'payload-plugin-icpay',
    icpay_kind: input.kind ?? 'payment'
  };

  return {
    amountUsd: input.amountUsd,
    description: input.description,
    metadata,
    paymentMethod: paymentMethod === 'stripe' ? 'stripe' : undefined,
    networkType: paymentMethod === 'stripe' ? 'stripe' : undefined,
    paymentIntent: input.paymentIntentId ? { id: input.paymentIntentId } : undefined,
    returnUrl: input.returnUrl,
    chainId: input.chainId,
    tokenShortcode: input.tokenShortcode,
    ledgerCanisterId: input.ledgerCanisterId,
    accountCanisterId: input.accountCanisterId,
    recipientAddress: input.recipientAddress ?? options.defaults?.recipientAddress,
    recipientAddresses: input.recipientAddresses ?? options.defaults?.recipientAddresses,
    externalCostAmount: input.externalCostAmount,
    fiat_currency: input.fiatCurrency ?? options.defaults?.fiatCurrency ?? 'USD'
  };
};

export const createIcpayClient = (
  options: IcpayPluginOptions,
  settings?: Record<string, unknown> | null
): Icpay => {
  return new Icpay(buildIcpayConfig(mergeSdkFromSettings(options, settings)));
};
