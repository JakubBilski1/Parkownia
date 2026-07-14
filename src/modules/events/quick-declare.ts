import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, parkings, venues } from "@/db/schema";
import { consumeActionToken } from "@/modules/auth/action-tokens";
import { declareAvailability } from "./availability";
import {
  isEventAvailabilityPayload,
  peekEventAvailabilityToken,
  type EventAvailabilityPayload,
  type TokenFailure,
} from "./tokens";
import type { QuickDeclareInput } from "./validation";

export type QuickDeclareOffer = {
  eventId: string;
  eventTitle: string;
  venueName: string;
  startsAt: Date;
  endsAt: Date;
  parkingId: string;
  parkingTitle: string | null;
  /** The offer the two buttons make. Fixed when the mail was sent, never posted by the client. */
  spots: number;
  priceGr: number;
};

export type QuickDeclareFailure = TokenFailure | "PARKING_NOT_OWNED";

export type QuickDeclareResolution<T> =
  | { ok: true; value: T }
  | { ok: false; reason: QuickDeclareFailure };

async function loadOffer(payload: EventAvailabilityPayload): Promise<QuickDeclareOffer | null> {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      venueName: venues.name,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, payload.eventId))
    .limit(1);

  const [parking] = await db
    .select({ id: parkings.id, title: parkings.title })
    .from(parkings)
    .where(eq(parkings.id, payload.parkingId))
    .limit(1);

  if (!event || !parking) return null;

  return {
    eventId: event.id,
    eventTitle: event.title,
    venueName: event.venueName,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    parkingId: parking.id,
    parkingTitle: parking.title,
    spots: payload.spots,
    priceGr: payload.priceGr,
  };
}

/** Opening the link only reads — the token is spent when a button is pressed, not before. */
export async function previewQuickDeclare(
  token: string,
): Promise<QuickDeclareResolution<QuickDeclareOffer>> {
  const peek = await peekEventAvailabilityToken(token);
  if (!peek.ok) return { ok: false, reason: peek.reason };

  const offer = await loadOffer(peek.payload);
  if (!offer) return { ok: false, reason: "TOKEN_INVALID" };

  return { ok: true, value: offer };
}

export type QuickDeclareOutcome = {
  accepted: boolean;
  offer: QuickDeclareOffer;
};

/**
 * Critical path 3: one click from the mail, no login. The token carries identity,
 * the parking and the offer; the request carries a single boolean. Spots and price
 * come from the token payload — a value posted by the client is never trusted.
 *
 * The peek is only there to tell "used" from "expired" for the copy; the burn is
 * consumeActionToken(), which locks the row, so two clicks cannot both go through.
 */
export async function quickDeclare(
  input: QuickDeclareInput,
): Promise<QuickDeclareResolution<QuickDeclareOutcome>> {
  const peek = await peekEventAvailabilityToken(input.token);
  if (!peek.ok) return { ok: false, reason: peek.reason };

  let payload: EventAvailabilityPayload;
  let userId: string;
  try {
    const consumed = await consumeActionToken("EVENT_AVAILABILITY", input.token);
    if (!isEventAvailabilityPayload(consumed.payload)) {
      return { ok: false, reason: "TOKEN_INVALID" };
    }
    payload = consumed.payload;
    userId = consumed.userId;
  } catch {
    // Lost the race with another click on the same link, or the token died between
    // the peek and the burn. Either way it is spent.
    return { ok: false, reason: "TOKEN_USED" };
  }

  const offer = await loadOffer(payload);
  if (!offer) return { ok: false, reason: "TOKEN_INVALID" };

  const declared = await declareAvailability({
    hostId: userId,
    eventId: offer.eventId,
    parkingId: offer.parkingId,
    isAvailable: input.accept,
    spots: input.accept ? offer.spots : null,
    priceGr: input.accept ? offer.priceGr : null,
  });

  if (!declared.ok) return { ok: false, reason: declared.reason };

  return { ok: true, value: { accepted: input.accept, offer } };
}
