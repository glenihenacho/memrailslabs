/**
 * Global test setup. Installs the billing meter into the kernel's metering
 * seam (side-effect import) so every test observes the same metered behavior
 * as the product entrypoints — the kernel itself no longer imports billing
 * (conversion phase C0).
 */
import '@/lib/billing/meter';
