import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tstz } from "@/db/time";
import { sendNotification } from "@/modules/notifications";
import { resolveCommissionSplit } from "@/modules/payouts/service";
import { suggestPriceGr, suggestSpots } from "./availability";
import { issueEventAvailabilityToken } from "./tokens";

export const HOST_PROMPT_TEMPLATE = "host-event-prompt";
export const REMINDER_LEAD_DAYS = 7;

type EventRow = {
  id: string;
  title: string;
  starts_at: Date;
  venue_name: string;
};

type CandidateRow = {
  user_id: string;
  email: string;
  phone: string | null;
  first_name: string | null;
  parking_id: string;
  parking_title: string | null;
  owner_type: "INDIVIDUAL" | "BUSINESS";
  capacity: number | null;
  price_per_event_gr: number | null;
  price_per_day_gr: number | null;
  straight_meters: number;
};

export type ReminderRun = {
  events: number;
  sent: number;
  failed: number;
  /** Hosts already reminded about this event, or who already answered. */
  skipped: number;
};

/** Events whose local start day is exactly REMINDER_LEAD_DAYS away from today (Europe/Warsaw). */
async function eventsInLeadWindow(now: Date): Promise<EventRow[]> {
  const rows = await db.execute<EventRow>(sql`
    SELECT e.id, e.title, e.starts_at, v.name AS venue_name
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    WHERE (e.starts_at AT TIME ZONE 'Europe/Warsaw')::date
        = (${tstz(now)} AT TIME ZONE 'Europe/Warsaw')::date
          + ${sql.raw(String(REMINDER_LEAD_DAYS))}
    ORDER BY e.starts_at ASC
  `);

  return Array.from(rows);
}

/**
 * One host, one e-mail, one parking: DISTINCT ON picks the parking closest to the
 * venue. A host with three lots near the stadium gets one question about the best
 * one, not three questions — the second question is where supply conversion dies.
 * Hosts who already answered for this event are excluded in SQL.
 */
async function candidatesFor(eventId: string): Promise<CandidateRow[]> {
  const rows = await db.execute<CandidateRow>(sql`
    SELECT DISTINCT ON (p.owner_id)
      p.owner_id AS user_id,
      u.email,
      u.phone,
      u.first_name,
      p.id AS parking_id,
      p.title AS parking_title,
      p.owner_type,
      p.capacity,
      p.price_per_event_gr,
      p.price_per_day_gr,
      ST_Distance(p.location, v.location)::float8 AS straight_meters
    FROM events e
    JOIN venues v ON v.id = e.venue_id
    JOIN parkings p
      ON p.status = 'ACTIVE'
     AND ST_DWithin(p.location, v.location, e.search_radius_meters)
    JOIN users u ON u.id = p.owner_id AND u.deleted_at IS NULL
    WHERE e.id = ${eventId}
      AND NOT EXISTS (
        SELECT 1 FROM event_parking_availability epa
        WHERE epa.event_id = e.id AND epa.parking_id = p.id
      )
    ORDER BY p.owner_id, straight_meters ASC
  `);

  return Array.from(rows);
}

/**
 * Daily cron. Idempotency is not hand-rolled here any more: sendNotification()
 * claims (user, template, relatedId) in notification_log before anything leaves
 * the process, and `host-event-prompt` is a dedupe:true template — so a second
 * run of the same day sends nothing. One dedup mechanism, one log row; the two
 * that used to exist wrote different template keys for the same mail.
 *
 * relatedId is the event: one invitation per host per event, which is the whole
 * point — the second invitation is where supply conversion dies.
 */
export async function sendEventReminders(now = new Date()): Promise<ReminderRun> {
  const run: ReminderRun = { events: 0, sent: 0, failed: 0, skipped: 0 };

  for (const event of await eventsInLeadWindow(now)) {
    run.events += 1;

    for (const candidate of await candidatesFor(event.id)) {
      const spots = suggestSpots(candidate.capacity, null);
      const priceGr = suggestPriceGr(
        null,
        candidate.price_per_event_gr,
        candidate.price_per_day_gr,
      );

      try {
        // What the host actually keeps, after our cut — computed from the same
        // rules that will price the real booking, never guessed in the template.
        const { hostPayoutGr } = await resolveCommissionSplit(db, {
          parkingId: candidate.parking_id,
          ownerId: candidate.user_id,
          ownerType: candidate.owner_type,
          priceGr: spots * priceGr,
        });

        const token = await issueEventAvailabilityToken({
          userId: candidate.user_id,
          expiresAt: event.starts_at,
          payload: { eventId: event.id, parkingId: candidate.parking_id, spots, priceGr },
        });

        const result = await sendNotification({
          template: "host-event-prompt",
          recipient: {
            userId: candidate.user_id,
            email: candidate.email,
            phone: candidate.phone,
          },
          relatedId: event.id,
          payload: {
            firstName: candidate.first_name,
            eventTitle: event.title,
            eventStartsAt: event.starts_at.toISOString(),
            venueName: event.venue_name,
            parkingTitle: candidate.parking_title ?? "Twój parking",
            straightLineMeters: candidate.straight_meters,
            suggestedSpots: spots,
            suggestedPriceGr: priceGr,
            estimatedPayoutGr: hostPayoutGr,
            actionToken: token,
          },
        });

        if (result.email === "sent") run.sent += 1;
        else if (result.email === "skipped") run.skipped += 1;
        else run.failed += 1;
      } catch {
        run.failed += 1;
      }
    }
  }

  return run;
}
