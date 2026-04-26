'use client';

import React, { useState } from 'react';
import { useConfig } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';

/**
 * List view toolbar: pull payments from icpay-api into `icpay-payments` via plugin endpoint.
 */
export function IcpaySyncPaymentsButton() {
  const {
    config: { serverURL, routes }
  } = useConfig();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const base = (serverURL || '').replace(/\/$/, '');
      const apiRoot = (routes?.api || '/api').replace(/\/$/, '');
      const url = `${base}${apiRoot}/icpay/sync-payments`;
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = (await res.json().catch(() => ({}))) as { synced?: number; error?: string };
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setMessage(`Synced ${data.synced ?? 0} payment(s).`);
      router.refresh();
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : 'Sync failed';
      setMessage(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
      <button type="button" className="btn btn--style-primary btn--size-medium" disabled={busy} onClick={onSync}>
        {busy ? 'Syncing…' : 'Sync payments from ICPay API'}
      </button>
      {message ? (
        <span style={{ fontSize: 13, opacity: 0.85 }} role="status">
          {message}
        </span>
      ) : null}
    </div>
  );
}
