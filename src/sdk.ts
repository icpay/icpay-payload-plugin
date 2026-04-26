import Icpay, { type CreateTransactionRequest, type IcpayConfig } from '@ic-pay/icpay-sdk';
import type { IcpayCheckoutInput, IcpayPluginOptions } from './types';

export const buildIcpayConfig = (options: IcpayPluginOptions): IcpayConfig => ({
  publishableKey: options.sdk.publishableKey,
  secretKey: options.sdk.secretKey,
  apiUrl: options.sdk.apiUrl,
  icHost: options.sdk.icHost,
  debug: options.sdk.debug ?? false
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

export const createIcpayClient = (options: IcpayPluginOptions): Icpay => {
  return new Icpay(buildIcpayConfig(options));
};
