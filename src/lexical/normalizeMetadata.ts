/**
 * One row from the widget block `metadata` array (Payload adds `id` on save).
 */
export type IcpayMetadataEntry = {
  id?: string;
  key?: string | null;
  value?: string | null;
};

/**
 * Turns admin **metadata** (array of `{ key, value }`, or a legacy JSON object) into a
 * plain object for `@ic-pay/icpay-widget` / checkout metadata.
 */
export function normalizeWidgetMetadata(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;

  if (Array.isArray(raw)) {
    const out: Record<string, unknown> = {};
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const entry = row as IcpayMetadataEntry;
      const key = String(entry.key ?? '').trim();
      if (!key) continue;
      const v = entry.value;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[key] = v === '' ? '' : v;
      } else if (v != null) {
        out[key] = String(v);
      } else {
        out[key] = '';
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (!Object.keys(o).length) return undefined;
    return { ...o };
  }

  return undefined;
}
