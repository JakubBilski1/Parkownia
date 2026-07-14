import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sendNotification } from "@/modules/notifications";
import type { AdminNotifier, ParkingDecisionMail } from "./ports";

type NextEventRow = {
  title: string;
  starts_at: Date;
  venue_name: string;
};

/**
 * The hook in the approval mail. A host who just got a parking approved is at
 * peak willingness; "your lot is 600 m from the Lech match next Saturday" is the
 * sentence that turns an approved listing into supply. If there is no upcoming
 * event in range we say nothing rather than invent urgency.
 */
async function nextEventNear(parkingId: string): Promise<NextEventRow | null> {
  const rows = await db.execute<NextEventRow>(sql`
    SELECT e.title, e.starts_at, v.name AS venue_name
    FROM parkings p
    JOIN venues v ON ST_DWithin(p.location, v.location, e.search_radius_meters)
    JOIN events e ON e.venue_id = v.id
    WHERE p.id = ${parkingId}
      AND e.starts_at > now()
    ORDER BY e.starts_at ASC
    LIMIT 1
  `);

  return Array.from(rows)[0] ?? null;
}

export function createAdminNotifier(): AdminNotifier {
  return {
    async parkingReviewed(mail: ParkingDecisionMail) {
      const [host] = await db
        .select({ email: users.email, phone: users.phone, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, mail.hostId))
        .limit(1);

      if (!host) return;

      const recipient = {
        userId: mail.hostId,
        email: host.email,
        phone: host.phone,
      };

      if (mail.decision === "REJECTED") {
        await sendNotification({
          template: "parking-rejected",
          recipient,
          relatedId: mail.parkingId,
          payload: {
            firstName: host.firstName,
            parkingId: mail.parkingId,
            parkingTitle: mail.parkingTitle,
            // The port guarantees this on REJECTED (the API is 422 without it).
            reason: mail.reason ?? "",
          },
        });
        return;
      }

      const nextEvent = await nextEventNear(mail.parkingId);

      await sendNotification({
        template: "parking-approved",
        recipient,
        relatedId: mail.parkingId,
        payload: {
          firstName: host.firstName,
          parkingId: mail.parkingId,
          parkingTitle: mail.parkingTitle,
          nextEvent: nextEvent
            ? {
                title: nextEvent.title,
                startsAt: nextEvent.starts_at.toISOString(),
                venueName: nextEvent.venue_name,
              }
            : null,
        },
      });
    },
  };
}
