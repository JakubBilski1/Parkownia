import { z } from "zod";
import { db } from "@/db";
import { driverSignups } from "@/db/schema";

/**
 * Demand recorded while the shop is shut.
 *
 * With no PSP configured the checkout is closed rather than broken (see
 * modules/payments/factory.ts). A driver who got that far still wanted a space,
 * and losing that is losing the only signal that says where supply is worth
 * chasing next — so it is written down instead.
 */

export const waitlistInputSchema = z.object({
  email: z.email({ message: "To nie wygląda na adres e-mail." }).max(254),
  parkingId: z.uuid().optional(),
  eventId: z.uuid().optional(),
  source: z.string().max(64).optional(),
  /** Honeypot. A human never fills it; same trick as the owners' lead form. */
  website: z.string().max(200).optional(),
});

export type WaitlistInput = z.infer<typeof waitlistInputSchema>;

export async function addToWaitlist(input: WaitlistInput): Promise<void> {
  await db
    .insert(driverSignups)
    .values({
      email: input.email.trim().toLowerCase(),
      parkingId: input.parkingId ?? null,
      eventId: input.eventId ?? null,
      source: input.source ?? null,
    })
    // Clicking twice is not two people. The unique key is (email, event), so the
    // same address still counts once per event it asked about.
    .onConflictDoNothing({ target: [driverSignups.email, driverSignups.eventId] });
}
