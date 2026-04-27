'use client';

import React, { useEffect, useMemo, useState } from 'react';

export type IcpayLexicalWidgetBlockData = {
  mode?: 'payment' | 'donation' | 'topup';
  title?: string;
  description?: string;
  recipientAddress?: string;
  metadata?: Record<string, unknown>;
  amountUsd?: number;
  goalUsd?: number;
  defaultAmountUsd?: number;
  minUsd?: number;
  maxUsd?: number;
  buttonLabel?: string;
};

export type IcpayLexicalWidgetDefaults = {
  publishableKey?: string;
  apiUrl?: string;
  fiatCurrency?: string;
  defaultRecipientAddress?: string;
};

type Props = {
  block: IcpayLexicalWidgetBlockData;
  defaults: IcpayLexicalWidgetDefaults;
};

export function IcpayLexicalWidgetRenderer({ block, defaults }: Props) {
  const [widgets, setWidgets] = useState<{
    IcpayPaymentWidget?: any;
    IcpayDonationWidget?: any;
    IcpayTopupWidget?: any;
  }>({});

  useEffect(() => {
    let mounted = true;
    import('../widgets')
      .then((m) => {
        if (!mounted) return;
        setWidgets({
          IcpayPaymentWidget: (m as any).IcpayPaymentWidget,
          IcpayDonationWidget: (m as any).IcpayDonationWidget,
          IcpayTopupWidget: (m as any).IcpayTopupWidget
        });
      })
      .catch(() => {
        if (!mounted) return;
        setWidgets({});
      });
    return () => {
      mounted = false;
    };
  }, []);

  const IcpayPaymentWidget = widgets.IcpayPaymentWidget;
  const IcpayDonationWidget = widgets.IcpayDonationWidget;
  const IcpayTopupWidget = widgets.IcpayTopupWidget;

  const publishableKey = defaults.publishableKey || '';
  const apiUrl = defaults.apiUrl;

  if (!publishableKey) {
    return (
      <p style={{ color: '#b91c1c' }}>
        ICPay widget skipped: missing publishable key (set in Globals → icpay-settings).
      </p>
    );
  }

  const recipientAddress =
    block.recipientAddress || defaults.defaultRecipientAddress || undefined;

  const common = useMemo(
    () => ({
      publishableKey,
      apiUrl,
      fiatCurrency: defaults.fiatCurrency?.trim() || 'USD',
      recipientAddress,
      metadata: block.metadata
    }),
    [apiUrl, block.metadata, defaults.fiatCurrency, publishableKey, recipientAddress]
  );

  const paymentAmountUsd = block.amountUsd != null ? Number(block.amountUsd) : 1;
  const paymentButtonLabel = block.buttonLabel?.trim() || 'Pay with icpay';

  return (
    <section style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #222', borderRadius: 8 }}>
      {block.title ? <h3 style={{ marginTop: 0 }}>{block.title}</h3> : null}
      {block.description ? <p>{block.description}</p> : null}

      {block.mode === 'donation' && IcpayDonationWidget ? (
        <IcpayDonationWidget
          {...common}
          goalUsd={Number(block.goalUsd || 0)}
          defaultAmountUsd={block.defaultAmountUsd}
          buttonLabel={block.buttonLabel?.trim() || undefined}
        />
      ) : null}

      {block.mode === 'topup' && IcpayTopupWidget ? (
        <IcpayTopupWidget
          {...common}
          defaultAmountUsd={block.defaultAmountUsd}
          minUsd={block.minUsd}
          maxUsd={block.maxUsd}
          buttonLabel={block.buttonLabel?.trim() || undefined}
        />
      ) : null}

      {block.mode !== 'donation' && block.mode !== 'topup' && IcpayPaymentWidget ? (
        <IcpayPaymentWidget
          {...common}
          amountUsd={paymentAmountUsd}
          buttonLabel={paymentButtonLabel}
        />
      ) : null}

      {!IcpayPaymentWidget && !IcpayDonationWidget && !IcpayTopupWidget ? (
        <p style={{ margin: 0, opacity: 0.8 }}>Loading ICPay widget...</p>
      ) : null}
    </section>
  );
}
