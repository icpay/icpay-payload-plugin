import type { ReactNode } from 'react';
import {
  type AmountInputConfig,
  type DonationThermometerConfig,
  type PayButtonConfig
} from '@ic-pay/icpay-widget';
import { IcpayAmountInput, IcpayDonationThermometer, IcpayPayButton } from '@ic-pay/icpay-widget/react';

type WidgetMode = 'payment' | 'donation' | 'topup';

export type IcpayWidgetBaseProps = {
  publishableKey: string;
  apiUrl?: string;
  fiatCurrency?: string;
  recipientAddress?: string;
  recipientAddresses?: { evm?: string; ic?: string; sol?: string };
  metadata?: Record<string, unknown>;
  /** When set, checkout only offers these ledger shortcodes (see `@ic-pay/icpay-widget` `CommonConfig`). */
  tokenShortcodes?: string[];
  onSuccess?: (detail: unknown) => void;
  onError?: (detail: unknown) => void;
};

export type IcpayPaymentWidgetProps = IcpayWidgetBaseProps & {
  amountUsd?: number;
  buttonLabel?: string;
};

export type IcpayDonationWidgetProps = IcpayWidgetBaseProps & {
  goalUsd: number;
  defaultAmountUsd?: number;
  amountsUsd?: number[];
  buttonLabel?: string;
};

export type IcpayTopupWidgetProps = IcpayWidgetBaseProps & {
  defaultAmountUsd?: number;
  minUsd?: number;
  maxUsd?: number;
  buttonLabel?: string;
};

const sharedConfig = (mode: WidgetMode, props: IcpayWidgetBaseProps) => ({
  publishableKey: props.publishableKey,
  apiUrl: props.apiUrl,
  fiat_currency: props.fiatCurrency ?? 'USD',
  recipientAddress: props.recipientAddress,
  recipientAddresses: props.recipientAddresses,
  ...(props.tokenShortcodes?.length ? { tokenShortcodes: props.tokenShortcodes } : {}),
  metadata: {
    ...(props.metadata ?? {}),
    icpay_context: `payload-plugin:${mode}`
  }
});

export const IcpayPaymentWidget = (props: IcpayPaymentWidgetProps): ReactNode => {
  const config: PayButtonConfig = {
    ...sharedConfig('payment', props),
    amountUsd: props.amountUsd,
    buttonLabel: props.buttonLabel ?? 'Pay with ICPay'
  };

  return <IcpayPayButton config={config} onSuccess={props.onSuccess as any} onError={props.onError as any} />;
};

export const IcpayDonationWidget = (props: IcpayDonationWidgetProps): ReactNode => {
  const config: DonationThermometerConfig = {
    ...sharedConfig('donation', props),
    goalUsd: props.goalUsd,
    defaultAmountUsd: props.defaultAmountUsd,
    amountsUsd: props.amountsUsd,
    buttonLabel: props.buttonLabel ?? 'Donate with ICPay'
  };

  return (
    <IcpayDonationThermometer config={config} onSuccess={props.onSuccess as any} onError={props.onError as any} />
  );
};

export const IcpayTopupWidget = (props: IcpayTopupWidgetProps): ReactNode => {
  const config: AmountInputConfig = {
    ...sharedConfig('topup', props),
    defaultAmountUsd: props.defaultAmountUsd,
    minUsd: props.minUsd,
    maxUsd: props.maxUsd,
    buttonLabel: props.buttonLabel ?? 'Top up with ICPay'
  };

  return <IcpayAmountInput config={config} onSuccess={props.onSuccess as any} onError={props.onError as any} />;
};
