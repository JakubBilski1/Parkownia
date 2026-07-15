import { pl } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import {
  APP_TIME_ZONE,
  formatBookings,
  formatDatePL,
  formatDateTimePL,
  formatMoney,
  formatSpots,
  formatTimePL,
  formatWalkDistance,
} from "@/lib/format";
import { bookingQrUrl } from "./qr";
import type { NotificationPayloads, TemplateId } from "./payloads";

export type { NotificationPayloads, TemplateId } from "./payloads";

/**
 * A template no longer renders anything. It turns a typed payload into the flat,
 * display-ready `data` that the mail API's MJML + Handlebars template interpolates
 * ({ template, to, data } → rendered server-side). Two rules keep the templates in
 * the pbdevs dashboard dumb, so they work with plain Handlebars and no helpers:
 *
 *   - every value is final: dates are Europe/Warsaw strings, money is "35 zł",
 *     because the renderer cannot do Polish locale;
 *   - every branch is resolved here: an enum becomes a boolean or a ready sentence,
 *     never `{{#if (eq x "HOST")}}`. The template needs only {{var}} and {{#if bool}}.
 */
type Template<K extends TemplateId> = {
  data: (payload: NotificationPayloads[K]) => EmailData | Promise<EmailData>;
  /**
   * Only two templates may ever define this. An SMS costs 0.08–0.12 zł against a
   * ~6 zł commission (docs/RISKS.md R16): it buys a code in the hand of someone at
   * a barrier, and nothing else is worth the money.
   */
  sms?: (payload: NotificationPayloads[K]) => string;
  /**
   * true  — send at most once per (user, template, relatedId); a repeat is a no-op.
   * false — a repeat is allowed (a payment can fail twice); the log row is updated.
   */
  dedupe: boolean;
};

type EmailData = Record<string, unknown>;

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://parkspot.pl";
  return `${base.replace(/\/$/, "")}${path}`;
}

/** Nawigacja prowadzi do wjazdu, nie do środka placu (CLAUDE.md). */
function entranceDirectionsUrl(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${lat}%2C${lng}`;
}

/** Where the driver's CTA points: the entrance if we have it, else the booking. */
function navOrBooking(
  bookingUrl: string,
  lat: number | null | undefined,
  lng: number | null | undefined,
): { ctaUrl: string; ctaLabel: string } {
  if (lat != null && lng != null) {
    return { ctaUrl: entranceDirectionsUrl(lat, lng), ctaLabel: "Nawiguj do wjazdu" };
  }
  return { ctaUrl: bookingUrl, ctaLabel: "Otwórz rezerwację" };
}

const WEEKDAY_ACCUSATIVE: Record<string, string> = {
  "1": "poniedziałek",
  "2": "wtorek",
  "3": "środę",
  "4": "czwartek",
  "5": "piątek",
  "6": "sobotę",
  "7": "niedzielę",
};

/** "sobotę, 25 lipca" — the accusative that follows "w" in the host prompt. */
function formatEventDayPL(value: string): string {
  const date = new Date(value);
  const isoDay = formatInTimeZone(date, APP_TIME_ZONE, "i");
  const dayMonth = formatInTimeZone(date, APP_TIME_ZONE, "d MMMM", { locale: pl });
  return `${WEEKDAY_ACCUSATIVE[isoDay] ?? ""}, ${dayMonth}`.replace(/^, /, "");
}

function cancelledSentence(cancelledBy: "DRIVER" | "HOST" | "ADMIN", code: string): string {
  switch (cancelledBy) {
    case "DRIVER":
      return `Anulowałeś rezerwację ${code}.`;
    case "HOST":
      return `Właściciel parkingu wycofał miejsce, więc anulowaliśmy rezerwację ${code}.`;
    case "ADMIN":
      return `Anulowaliśmy rezerwację ${code}.`;
  }
}

function refundNote(priceGr: number, refundGr: number): string {
  if (refundGr === 0) {
    return "Anulowanie na mniej niż 2 godziny przed startem nie daje zwrotu — tak działa polityka, którą zaakceptowałeś przy zakupie.";
  }
  if (refundGr >= priceGr) {
    return "Pieniądze wracają tą samą drogą, którą przyszły (BLIK lub karta). Zwykle 1–3 dni robocze, maksymalnie 10.";
  }
  return "Zwrot częściowy wynika z polityki anulowania obowiązującej przy zakupie. Pieniądze wracają tą samą drogą, którą przyszły — zwykle 1–3 dni robocze, maksymalnie 10.";
}

function entranceLine(notes: string | null | undefined): string {
  if (!notes) return "";
  const trimmed = notes.trim().replace(/\.$/, "");
  return /^wjazd/i.test(trimmed) ? `${trimmed}.` : `Wjazd: ${trimmed}.`;
}

/* -------------------------------------------------------------------------- */
/* templates                                                                  */
/* -------------------------------------------------------------------------- */

export const templates: { [K in TemplateId]: Template<K> } = {
  "booking-confirmed": {
    data: async (p) => {
      const bookingUrl = appUrl(`/rezerwacja/${p.bookingId}`);
      return {
        firstName: p.firstName ?? "",
        code: p.code,
        parkingTitle: p.parkingTitle,
        address: p.address,
        startsAt: formatDateTimePL(p.startsAt),
        endsAt: formatDateTimePL(p.endsAt),
        spots: formatSpots(p.spots),
        price: formatMoney(p.priceGr),
        eventTitle: p.eventTitle ?? "",
        entranceNotes: p.entranceNotes ?? "",
        accessInstructions: p.accessInstructions ?? "",
        // Empty string when the upload fails or storage is unconfigured; the
        // template hides the <img> and leans on the code text. See qr.ts.
        qrUrl: (await bookingQrUrl(p.code)) ?? "",
        bookingUrl,
        ...navOrBooking(bookingUrl, p.entranceLat, p.entranceLng),
      };
    },
    sms: (p) =>
      [
        `ParkSpot. Kod: ${p.code}.`,
        `${p.parkingTitle}, ${formatDateTimePL(p.startsAt)}.`,
        entranceLine(p.entranceNotes),
      ]
        .filter(Boolean)
        .join(" "),
    dedupe: true,
  },

  "booking-reminder": {
    data: (p) => {
      const bookingUrl = appUrl(`/rezerwacja/${p.bookingId}`);
      return {
        firstName: p.firstName ?? "",
        code: p.code,
        parkingTitle: p.parkingTitle,
        address: p.address,
        startsAt: formatDateTimePL(p.startsAt),
        entranceNotes: p.entranceNotes ?? "",
        accessInstructions: p.accessInstructions ?? "",
        bookingUrl,
        ...navOrBooking(bookingUrl, p.entranceLat, p.entranceLng),
      };
    },
    sms: (p) =>
      [
        `ParkSpot. Za 2 h: ${p.parkingTitle}, ${formatDateTimePL(p.startsAt)}.`,
        `Kod: ${p.code}.`,
        entranceLine(p.entranceNotes),
      ]
        .filter(Boolean)
        .join(" "),
    dedupe: true,
  },

  "booking-cancelled": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      code: p.code,
      parkingTitle: p.parkingTitle,
      startsAt: formatDateTimePL(p.startsAt),
      price: formatMoney(p.priceGr),
      refund: formatMoney(p.refundGr),
      whatHappened: cancelledSentence(p.cancelledBy, p.code),
      // Reason is shown only when someone other than the driver cancelled.
      reason: p.cancelledBy !== "DRIVER" ? (p.reason ?? "") : "",
      refundNote: refundNote(p.priceGr, p.refundGr),
      byHost: p.cancelledBy === "HOST",
      mapUrl: appUrl("/mapa"),
    }),
    dedupe: true,
  },

  "payment-failed": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      parkingTitle: p.parkingTitle,
      price: formatMoney(p.priceGr),
      charged: p.charged,
      holdUntil: p.holdExpiresAt ? formatDateTimePL(p.holdExpiresAt) : "",
      retryUrl: appUrl(`/rezerwacja/${p.bookingId}/platnosc`),
      mapUrl: appUrl("/mapa"),
    }),
    dedupe: false,
  },

  "host-event-prompt": {
    data: (p) => {
      const shareUrl = appUrl(`/udostepnij/${p.actionToken}`);
      return {
        firstName: p.firstName ?? "",
        eventTitle: p.eventTitle,
        // eventDate — nominative "sob., 25 lipca" for the subject line; eventDay is
        // the accusative "sobotę, 25 lipca" the body sentence needs after "w".
        eventDate: formatDatePL(p.eventStartsAt),
        eventDay: formatEventDayPL(p.eventStartsAt),
        eventTime: formatTimePL(p.eventStartsAt),
        venueName: p.venueName,
        parkingTitle: p.parkingTitle,
        walkDistance: formatWalkDistance(p.straightLineMeters),
        suggestion: `${formatSpots(p.suggestedSpots)} po ${formatMoney(p.suggestedPriceGr)}`,
        payout: formatMoney(p.estimatedPayoutGr),
        shareUrl,
        declineUrl: `${shareUrl}?odpowiedz=nie`,
      };
    },
    dedupe: true,
  },

  "host-payout": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      amount: formatMoney(p.amountGr),
      bookings: formatBookings(p.bookingsCount),
      periodStart: formatDatePL(p.periodStart),
      periodEnd: formatDatePL(p.periodEnd),
      accountLast4: p.accountLast4 ?? "",
      earningsUrl: appUrl("/panel/zarobki"),
    }),
    dedupe: true,
  },

  "parking-approved": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      parkingTitle: p.parkingTitle,
      hasEvent: p.nextEvent != null,
      eventLine: p.nextEvent
        ? `${p.nextEvent.title}, ${formatDatePL(p.nextEvent.startsAt)} o ${formatTimePL(p.nextEvent.startsAt)} na ${p.nextEvent.venueName}`
        : "",
      availabilityUrl: appUrl(`/panel/parkingi/${p.parkingId}`),
    }),
    dedupe: true,
  },

  "parking-rejected": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      parkingTitle: p.parkingTitle,
      reason: p.reason,
      fixUrl: appUrl(`/panel/parkingi/${p.parkingId}`),
    }),
    dedupe: false,
  },

  "password-reset": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      expiresInMinutes: p.expiresInMinutes,
      resetUrl: appUrl(`/haslo/reset/${p.actionToken}`),
    }),
    dedupe: false,
  },

  "data-export": {
    data: (p) => ({
      firstName: p.firstName ?? "",
      expiresAt: formatDateTimePL(p.expiresAt),
      downloadUrl: appUrl(`/konto/eksport/${p.actionToken}`),
    }),
    dedupe: false,
  },
};
