import type { IcpayPluginOptions } from '../types';
import { createIcpayClient, toCreateTransactionRequest } from '../sdk';

export type IcpayCommerceHookArgs = {
  context?: Record<string, unknown>;
  paymentIntentId?: string;
  amountUsd?: number | string;
  fiatCurrency?: string;
  metadata?: Record<string, unknown>;
  description?: string;
  recipientAddress?: string;
  recipientAddresses?: { evm?: string; ic?: string; sol?: string };
  returnUrl?: string;
};

/**
 * Optional helper for Payload Ecommerce payment hooks.
 * It is deliberately "shape-agnostic" so users can attach it to the latest
 * ecommerce hook signatures without waiting for plugin updates.
 */
export const createIcpayEcommerceBridge = (options: IcpayPluginOptions) => {
  return {
    beforeInitiatePayment: async (args: IcpayCommerceHookArgs) => {
      const request = toCreateTransactionRequest(
        {
          kind: 'payment',
          amountUsd: args.amountUsd,
          fiatCurrency: args.fiatCurrency,
          description: args.description ?? 'Payload commerce checkout',
          paymentIntentId: args.paymentIntentId,
          metadata: {
            ...(args.metadata ?? {}),
            icpay_context: 'payload-ecommerce:beforeInitiatePayment'
          },
          recipientAddress: args.recipientAddress,
          recipientAddresses: args.recipientAddresses,
          returnUrl: args.returnUrl
        },
        options
      );

      const client = createIcpayClient(options);
      const response = await client.createPayment(request);

      return {
        icpay: {
          request,
          response
        }
      };
    },

    beforeConfirmOrder: async (args: IcpayCommerceHookArgs) => {
      return {
        icpay: {
          status: 'pending_confirmation',
          paymentIntentId: args.paymentIntentId ?? null
        }
      };
    },

    afterConfirmOrder: async (args: IcpayCommerceHookArgs) => {
      return {
        icpay: {
          status: 'confirmed',
          paymentIntentId: args.paymentIntentId ?? null
        }
      };
    }
  };
};

export default createIcpayEcommerceBridge;
