/**
 * Shared by admin token picker (bundled with Payload) and lexical normalizers.
 * Lives under `src/admin` so it is included in the package `files` field.
 */

export type IcpayWidgetChainType = 'ic' | 'evm' | 'sol' | 'stripe';

/** Map ledger / API `chainType` strings to widget wallet-filter keys. */
export function mapLedgerChainTypeToWidget(raw: string | null | undefined): IcpayWidgetChainType | null {
  const t = String(raw || '')
    .toLowerCase()
    .trim();
  if (!t) return null;
  if (t === 'ic' || t === 'internet_computer' || t.includes('internet computer')) return 'ic';
  if (t === 'evm' || t === 'ethereum' || t.startsWith('evm')) return 'evm';
  if (t === 'sol' || t === 'solana') return 'sol';
  if (t === 'stripe' || t === 'card' || t === 'fiat') return 'stripe';
  return null;
}
