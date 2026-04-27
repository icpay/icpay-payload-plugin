'use client';

import React, { useMemo } from 'react';
import { useConfig } from '@payloadcms/ui';

/**
 * Must match plugin `apiBasePath` (default `/icpay`). Set `NEXT_PUBLIC_ICPAY_API_BASE` in the Next app if you override it.
 */
function webhookApiBase(): string {
  const raw =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_ICPAY_API_BASE) || '/icpay';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  return withSlash.replace(/\/$/, '') || '/icpay';
}

/**
 * Read-only help + URL for configuring ICPay → Payload webhooks (Globals → icpay-settings).
 */
export function IcpayWebhookEndpointHelp() {
  const {
    config: { serverURL, routes }
  } = useConfig();

  const webhookUrl = useMemo(() => {
    const base = (serverURL || '').replace(/\/$/, '');
    const apiRoot = (routes?.api || '/api').replace(/\/$/, '');
    const path = `${webhookApiBase()}/webhook`;
    return `${base}${apiRoot}${path}`;
  }, [serverURL, routes?.api]);

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ margin: '0 0 0.75rem', fontSize: 13, lineHeight: 1.5, color: 'var(--theme-elevation-800, #333)' }}>
        Point <strong>icpay-api</strong> (or your merchant webhook settings in ICPay) at this URL so payment events are
        delivered to Payload. Use <strong>HTTPS</strong> in production.
      </p>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          marginBottom: '0.35rem',
          color: 'var(--theme-elevation-600, #555)'
        }}
      >
        Webhook URL
      </label>
      <input
        type="text"
        readOnly
        value={webhookUrl}
        onFocus={(e) => e.currentTarget.select()}
        style={{
          width: '100%',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: 13,
          padding: '0.5rem 0.65rem',
          marginBottom: '0.85rem',
          borderRadius: 4,
          border: '1px solid var(--theme-elevation-150, #ccc)',
          background: 'var(--theme-elevation-50, #f9f9f9)'
        }}
        aria-label="ICPay webhook URL for Payload"
      />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--theme-elevation-800, #333)' }}>
        Use the same <strong>SDK secret key</strong> as <code style={{ fontSize: 12 }}>secretKey</code> above. icpay-api sends{' '}
        <code style={{ fontSize: 12 }}>X-ICPay-Signature</code> as{' '}
        <code style={{ fontSize: 12 }}>t=&lt;unix&gt;,v1=&lt;hex&gt;</code>, where v1 is HMAC-SHA256 of the string{' '}
        <em>timestamp + dot + raw POST body</em>, keyed by that secret (same algorithm as icpay-api webhooks). If{' '}
        <code style={{ fontSize: 12 }}>secretKey</code> is empty, verification is skipped (like WooCommerce with no secret).
        A plain hex HMAC of the raw body (no <code style={{ fontSize: 12 }}>t=</code> prefix) is also accepted for older
        clients.
      </p>
      <p style={{ margin: '0.75rem 0 0', fontSize: 13, lineHeight: 1.5, color: 'var(--theme-elevation-800, #333)' }}>
        Valid requests are normalized and upserted into the <strong>ICPay Payments</strong> collection.
      </p>
    </div>
  );
}
