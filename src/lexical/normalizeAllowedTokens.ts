/**
 * Normalizes stored widget value into `CommonConfig.tokenShortcodes` / `chainTypes`.
 * Supports: JSON `string[]` (admin picker legacy), `{ tokenShortcodes, chainTypes }`,
 * array of `{ tokenShortcode }` rows, or JSON string (Lexical / API).
 */

import { mapLedgerChainTypeToWidget, type IcpayWidgetChainType } from '../admin/icpayLedgerChainTypes';

export type { IcpayWidgetChainType };
export { mapLedgerChainTypeToWidget };

export type IcpayAllowedTokenRow = {
  id?: string;
  tokenShortcode?: string | null;
};

function dedupeShortcodes(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sc of list) {
    const key = sc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sc);
  }
  return out;
}

function normalizeShortcodesFromArray(raw: unknown[]): string[] | undefined {
  const out: string[] = [];
  for (const row of raw) {
    let sc = '';
    if (typeof row === 'string') {
      sc = row.trim();
    } else if (row && typeof row === 'object' && 'tokenShortcode' in row) {
      sc = String((row as IcpayAllowedTokenRow).tokenShortcode ?? '').trim();
    }
    if (sc) out.push(sc);
  }
  const d = dedupeShortcodes(out);
  return d.length ? d : undefined;
}

function normalizeChainTypesArray(raw: unknown): IcpayWidgetChainType[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const allowed = new Set<IcpayWidgetChainType>(['ic', 'evm', 'sol', 'stripe']);
  const out: IcpayWidgetChainType[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const mapped = mapLedgerChainTypeToWidget(typeof row === 'string' ? row : String(row));
    if (!mapped || !allowed.has(mapped)) continue;
    const k = mapped.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(mapped);
  }
  return out.length ? out : undefined;
}

export type IcpayAllowedTokensFilter = {
  tokenShortcodes?: string[];
  chainTypes?: IcpayWidgetChainType[];
};

/**
 * When both are empty / missing, the widget shows all tokens and wallet types.
 */
export function normalizeAllowedTokensFilter(raw: unknown): IcpayAllowedTokensFilter {
  if (raw == null) return {};

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return {};
    try {
      return normalizeAllowedTokensFilter(JSON.parse(t));
    } catch {
      return {};
    }
  }

  if (Array.isArray(raw)) {
    const tokenShortcodes = normalizeShortcodesFromArray(raw);
    return tokenShortcodes?.length ? { tokenShortcodes } : {};
  }

  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const nested = o.tokenShortcodes ?? o.token_shortcodes;
    let tokenShortcodes: string[] | undefined;
    if (Array.isArray(nested)) {
      tokenShortcodes = normalizeShortcodesFromArray(nested);
    } else if (typeof nested === 'string') {
      tokenShortcodes = normalizeAllowedTokensFilter(nested).tokenShortcodes;
    }

    const chainRaw = o.chainTypes ?? o.chain_types;
    let chainTypes = normalizeChainTypesArray(chainRaw);

    const out: IcpayAllowedTokensFilter = {};
    if (tokenShortcodes?.length) out.tokenShortcodes = tokenShortcodes;
    if (chainTypes?.length) out.chainTypes = chainTypes;
    return out;
  }

  return {};
}

/**
 * Returns `undefined` when empty so `@ic-pay/icpay-widget` treats it as “no filter” (all tokens).
 */
export function normalizeAllowedTokenShortcodes(raw: unknown): string[] | undefined {
  const { tokenShortcodes } = normalizeAllowedTokensFilter(raw);
  return tokenShortcodes?.length ? tokenShortcodes : undefined;
}
