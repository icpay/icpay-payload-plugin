import type { CollectionSlug, Config, Endpoint } from 'payload';
import type { CreateTransactionRequest, IcpayConfig } from '@ic-pay/icpay-sdk';

export type IcpayCheckoutKind = 'payment' | 'donation' | 'topup' | 'custom';

export type IcpayCheckoutInput = {
  kind?: IcpayCheckoutKind;
  amountUsd?: number | string;
  fiatCurrency?: string;
  description?: string;
  recipientAddress?: string;
  recipientAddresses?: {
    evm?: string;
    ic?: string;
    sol?: string;
  };
  metadata?: Record<string, unknown>;
  paymentMethod?: 'wallet' | 'stripe' | 'x402';
  paymentIntentId?: string;
  returnUrl?: string;
  chainId?: string;
  tokenShortcode?: string;
  ledgerCanisterId?: string;
  accountCanisterId?: string;
  externalCostAmount?: string | number;
};

export type IcpayWebhookRecord = {
  eventType: string;
  eventId?: string;
  paymentIntentId?: string;
  signature?: string;
  payload: Record<string, unknown>;
};

export type IcpayPluginCollections = {
  payments?: CollectionSlug;
};

export type IcpaySyncOptions = {
  /**
   * Relative path on `sdk.apiUrl` used by sync endpoint.
   * Must return either `{ items: [...] }` or an array.
   */
  endpointPath?: string;
  method?: 'GET' | 'POST';
  /**
   * Max items to request per sync call.
   */
  limit?: number;
};

export type IcpayPluginOptions = {
  enabled?: boolean;
  slug?: string;
  apiBasePath?: string;
  collections?: IcpayPluginCollections;
  /**
   * Optional SDK defaults (env). Prefer configuring `icpay-settings` global in admin:
   * publishableKey, secretKey, apiUrl, webhookSecret.
   */
  sdk?: Partial<Pick<IcpayConfig, 'publishableKey' | 'secretKey' | 'apiUrl' | 'icHost' | 'debug'>>;
  /**
   * When true (default), registers a beforeList button on `icpay-payments` to call sync endpoint.
   * Resolved via package export `@ic-pay/payload-plugin-icpay/icpay-sync-payments`.
   */
  enableSyncPaymentsButton?: boolean;
  defaults?: {
    fiatCurrency?: string;
    recipientAddress?: string;
    recipientAddresses?: {
      evm?: string;
      ic?: string;
      sol?: string;
    };
    metadata?: Record<string, unknown>;
  };
  allowedKinds?: IcpayCheckoutKind[];
  webhookSecret?: string;
  sync?: IcpaySyncOptions;
  createCollections?: boolean;
  createGlobalSettings?: boolean;
  additionalEndpoints?: Endpoint[];
  /**
   * Hook to transform a checkout payload before creating a payment in ICPay.
   */
  mapCheckoutToIcpayRequest?: (input: IcpayCheckoutInput) => CreateTransactionRequest;
  /**
   * Hook that runs after a payment is created.
   */
  onPaymentCreated?: (args: {
    checkout: IcpayCheckoutInput;
    response: unknown;
    req: unknown;
  }) => Promise<void> | void;
  /**
   * Hook that runs after webhook payload is accepted by the plugin.
   */
  onWebhook?: (event: IcpayWebhookRecord, req: unknown) => Promise<void> | void;
  /**
   * Optional custom config extension for advanced users.
   */
  extendConfig?: (config: Config) => Config;
};

export type IcpayGlobalSettings = {
  publishableKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  apiUrl?: string;
  defaultFiatCurrency?: string;
  defaultRecipientAddress?: string;
};
