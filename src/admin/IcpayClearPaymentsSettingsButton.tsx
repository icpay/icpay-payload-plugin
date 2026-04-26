'use client';

import React, { useState } from 'react';
import { useConfig } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';

const CONFIRM_MESSAGE =
  'Delete ALL records in the ICPay Payments collection?\n\n' +
  'This only removes rows stored in Payload. It does not cancel or refund payments in ICPay. This cannot be undone.';

/**
 * Shown on Globals → icpay-settings (before document controls).
 */
export function IcpayClearPaymentsSettingsButton() {
  const {
    config: { serverURL, routes }
  } = useConfig();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onClear = async () => {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    setBusy(true);
    setMessage(null);
    try {
      const base = (serverURL || '').replace(/\/$/, '');
      const apiRoot = (routes?.api || '/api').replace(/\/$/, '');
      const url = `${base}${apiRoot}/icpay/clear-payments`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = (await res.json().catch(() => ({}))) as { deleted?: number; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setMessage(`Deleted ${data.deleted ?? 0} record(s).`);
      router.refresh();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : 'Failed to clear payments.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginBottom: '1.5rem',
        padding: '1rem',
        border: '1px solid rgba(220, 38, 38, 0.45)',
        borderRadius: 6,
        background: 'rgba(220, 38, 38, 0.06)'
      }}
    >
      <p style={{ margin: '0 0 0.75rem', fontWeight: 600, color: '#b91c1c' }}>Danger zone</p>
      <p style={{ margin: '0 0 1rem', fontSize: 13, lineHeight: 1.45 }}>
        Permanently remove every document in the <strong>ICPay Payments</strong> collection. This only affects
        Payload&apos;s copy of payment data (sync/webhook rows). <strong>This cannot be undone.</strong>
      </p>
      <button
        type="button"
        className="btn btn--style-primary btn--size-medium"
        style={{ background: '#b91c1c', borderColor: '#991b1b' }}
        disabled={busy}
        onClick={onClear}
      >
        {busy ? 'Deleting…' : 'Delete all payment records'}
      </button>
      {message ? (
        <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: 13 }} role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
