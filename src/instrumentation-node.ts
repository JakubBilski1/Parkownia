import { registerAdminNotifier, registerPaymentRefunder } from "@/modules/admin/ports";
import { createAdminNotifier } from "@/modules/admin/notifier";
import { createAdminRefunder } from "@/modules/payments/admin-refunder";

/**
 * Node-only half of the boot wiring. It lives in its own module because
 * instrumentation.ts is compiled for the Edge runtime as well, and everything
 * below reaches the database and native deps (@node-rs/argon2, postgres) —
 * none of which exist on Edge.
 *
 * The admin module talks to payments and notifications through ports
 * (src/modules/admin/ports.ts) so the two never import each other; this is the
 * one place that fills those ports in.
 *
 * Unregistered, the panel degrades honestly rather than lying: a refund on a
 * PSP-backed payment refuses with 503 instead of writing "REFUNDED" over money
 * that is still sitting at Stripe, and moderation still works but reports that
 * the host was never told. Both are correct failure modes — and both are the
 * wrong ones to ship, which is why this file exists.
 */
registerPaymentRefunder(createAdminRefunder());
registerAdminNotifier(createAdminNotifier());
