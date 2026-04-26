import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Absolute path + named export for Payload admin import map (must exist on disk).
 * Resolves from this package's `dist/` up to package root, then `src/admin/...`.
 */
export function resolveIcpaySyncPaymentsButtonPath(): string | undefined {
  try {
    const distDir = path.dirname(fileURLToPath(import.meta.url));
    const pkgRoot = path.resolve(distDir, '..');
    const abs = path.join(pkgRoot, 'src', 'admin', 'IcpaySyncPaymentsButton.tsx');
    if (fs.existsSync(abs)) {
      return `${abs.replace(/\\/g, '/')}#IcpaySyncPaymentsButton`;
    }
  } catch {
    // ignore
  }
  return undefined;
}
