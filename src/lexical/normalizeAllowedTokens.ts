/**
 * Normalizes stored widget value into `string[]` for `CommonConfig.tokenShortcodes`.
 * Supports: JSON `string[]` (admin picker), legacy array of `{ tokenShortcode }` rows, or JSON string.
 */
export type IcpayAllowedTokenRow = {
  id?: string;
  tokenShortcode?: string | null;
};

/**
 * Returns `undefined` when empty so `@ic-pay/icpay-widget` treats it as “no filter” (all tokens).
 */
export function normalizeAllowedTokenShortcodes(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return undefined;
    try {
      return normalizeAllowedTokenShortcodes(JSON.parse(t));
    } catch {
      return undefined;
    }
  }

  if (!Array.isArray(raw) || raw.length === 0) return undefined;

  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    let sc = '';
    if (typeof row === 'string') {
      sc = row.trim();
    } else if (row && typeof row === 'object' && 'tokenShortcode' in row) {
      sc = String((row as IcpayAllowedTokenRow).tokenShortcode ?? '').trim();
    }
    if (!sc) continue;
    const key = sc.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(sc);
  }

  return out.length ? out : undefined;
}
