'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfig, useField } from '@payloadcms/ui';

type LedgerRow = {
  shortcode: string;
  symbol?: string;
  name?: string;
  chainName: string;
};

type ChainGroup = {
  chainName: string;
  ledgers: LedgerRow[];
};

function coalesceToShortcodeList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];
    if (typeof raw[0] === 'string') {
      return (raw as string[]).map((s) => String(s).trim()).filter(Boolean);
    }
    return raw
      .map((row) => {
        if (row && typeof row === 'object' && 'tokenShortcode' in row) {
          return String((row as { tokenShortcode?: string }).tokenShortcode ?? '').trim();
        }
        return '';
      })
      .filter(Boolean);
  }
  return [];
}

type Props = {
  path: string;
  field?: { label?: string; admin?: { description?: string } };
};

/**
 * JSON field UI: stores `string[]` of ledger shortcodes (empty = all tokens).
 * Options load from ICPay API via plugin {@link createIcpayEndpoints} `GET …/public-ledgers`.
 */
export function IcpayAllowedTokensPickerField({ path, field }: Props) {
  const { config } = useConfig();
  const { value, setValue } = useField<unknown>({ path });

  const selected = useMemo(() => {
    const list = coalesceToShortcodeList(value);
    return new Set(list.map((s) => s.toLowerCase()));
  }, [value]);

  const [chains, setChains] = useState<ChainGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const apiBasePath =
    (config as { custom?: { icpayApiBasePath?: string } }).custom?.icpayApiBasePath ?? '/icpay';
  const apiRoot = (config.routes?.api || '/api').replace(/\/$/, '');
  const url = `${apiRoot}${apiBasePath}/public-ledgers`;

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url, { method: 'GET', credentials: 'include' });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          chains?: ChainGroup[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }
        if (!mounted) return;
        setChains(Array.isArray(data.chains) ? data.chains : []);
      } catch (e: unknown) {
        if (!mounted) return;
        setChains([]);
        setError(e instanceof Error ? e.message : 'Failed to load tokens');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [url]);

  const toggle = useCallback(
    (shortcode: string) => {
      const sc = String(shortcode || '').trim();
      if (!sc) return;
      const current = coalesceToShortcodeList(value);
      const key = sc.toLowerCase();
      const exists = current.some((s) => s.toLowerCase() === key);
      const next = exists ? current.filter((s) => s.toLowerCase() !== key) : [...current, sc];
      setValue(next.length ? next : []);
    },
    [setValue, value]
  );

  const clearAll = useCallback(() => {
    setValue([]);
  }, [setValue]);

  const filteredChains = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chains;
    return chains
      .map((g) => ({
        ...g,
        ledgers: g.ledgers.filter((l) => {
          return (
            String(l.symbol || '').toLowerCase().includes(q) ||
            String(l.shortcode || '').toLowerCase().includes(q) ||
            String(l.name || '').toLowerCase().includes(q) ||
            String(l.chainName || '').toLowerCase().includes(q)
          );
        })
      }))
      .filter((g) => g.ledgers.length > 0);
  }, [chains, query]);

  const label = field?.label ?? 'Filter allowed tokens (optional)';
  const description =
    field?.admin?.description ??
    'Pick tokens to limit checkout options. Leave none selected for every supported token. Data comes from ICPay API using Globals → icpay-settings.';

  return (
    <div className="field-type json" style={{ marginBottom: '1.25rem' }}>
      <div className="field-type__label" style={{ marginBottom: 6 }}>
        <label style={{ fontWeight: 600 }}>{label}</label>
      </div>
      <p className="field-description" style={{ margin: '0 0 8px', fontSize: 13, opacity: 0.85 }}>
        {description}
      </p>

      {loading ? <p style={{ fontSize: 13 }}>Loading tokens from ICPay…</p> : null}
      {error ? (
        <p style={{ fontSize: 13, color: 'var(--theme-error-500, #b91c1c)' }} role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && chains.length > 0 ? (
        <>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by symbol, name, or chain"
            style={{
              width: '100%',
              maxWidth: 420,
              marginBottom: 10,
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--theme-elevation-150, #ccc)'
            }}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <button type="button" className="btn btn--style-secondary btn--size-small" onClick={clearAll}>
              Clear selection (all tokens)
            </button>
            <span style={{ fontSize: 12, opacity: 0.75 }}>
              {selected.size} token{selected.size === 1 ? '' : 's'} selected
            </span>
          </div>
          <div
            style={{
              maxHeight: 320,
              overflowY: 'auto',
              border: '1px solid var(--theme-elevation-100, #e0e0e0)',
              borderRadius: 6,
              padding: 8
            }}
          >
            {filteredChains.map((group) => (
              <div key={group.chainName} style={{ marginBottom: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{group.chainName}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.ledgers.map((l) => {
                    const on = selected.has(l.shortcode.toLowerCase());
                    return (
                      <label
                        key={`${group.chainName}-${l.shortcode}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggle(l.shortcode)}
                        />
                        <span>
                          <strong>{l.symbol || l.shortcode}</strong>
                          {l.name ? <span style={{ opacity: 0.8 }}> — {l.name}</span> : null}
                          <span style={{ opacity: 0.65, marginLeft: 6 }}>({l.shortcode})</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {!loading && !error && chains.length === 0 ? (
        <p style={{ fontSize: 13, opacity: 0.8 }}>No verified ledgers returned from ICPay.</p>
      ) : null}
    </div>
  );
}
