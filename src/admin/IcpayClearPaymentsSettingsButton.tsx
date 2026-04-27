'use client';

import React, { useState } from 'react';
import { useConfig } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';

const CONFIRM_MESSAGE =
  'Delete every row in the ICPay Payments collection?\n\n' +
  'This only removes payment records stored in Payload (from sync or webhooks). ' +
  'It does not cancel or refund anything in ICPay.\n\n' +
  'This cannot be undone.';

/**
 * Renders as a `ui` field on Globals → icpay-settings (below other fields).
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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      <button type="button" className="btn btn--style-secondary btn--size-medium" disabled={busy} onClick={onClear}>
        {busy ? 'Deleting…' : 'Delete all payment records'}
      </button>
      {message ? (
        <span style={{ fontSize: 13 }} role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
