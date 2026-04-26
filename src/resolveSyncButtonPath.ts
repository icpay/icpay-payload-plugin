/**
 * Package subpath (not a filesystem path) so Payload’s import map and Next resolve
 * the same module in dev, Docker, and CI — absolute paths break when rewritten to relative imports.
 *
 * @see package.json `exports["./icpay-sync-payments"]`
 */
export function resolveIcpaySyncPaymentsButtonPath(): string {
  return '@ic-pay/payload-plugin-icpay/icpay-sync-payments#IcpaySyncPaymentsButton';
}
