/**
 * Global test setup. Installs the billing meter into the kernel's metering
 * seam (side-effect import) so every test observes the same metered behavior
 * as the product entrypoints — the kernel itself no longer imports billing
 * (conversion phase C0).
 *
 * Under MEMRAILS_AUTHORITY=postgres (`npm run test:pg`) this also boots the
 * embedded Postgres authority and hydrates the snapshot before any test's
 * synchronous reads run (conversion phase C2). No-op in file mode.
 */
import '@/lib/billing/meter';
import { ensureAuthorityReady } from '@/lib/memory/authority';

await ensureAuthorityReady();
