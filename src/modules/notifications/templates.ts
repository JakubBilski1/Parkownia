import { createElement, type ReactElement } from "react";
import QRCode from "qrcode";
import { formatDatePL, formatDateTimePL, formatMoney } from "@/lib/format";
import BookingCancelled, { type BookingCancelledProps } from "../../../emails/booking-cancelled";
import BookingConfirmed, { type BookingConfirmedProps } from "../../../emails/booking-confirmed";
import BookingReminder, { type BookingReminderProps } from "../../../emails/booking-reminder";
import DataExport, { type DataExportProps } from "../../../emails/data-export";
import HostEventPrompt, { type HostEventPromptProps } from "../../../emails/host-event-prompt";
import HostPayout, { type HostPayoutProps } from "../../../emails/host-payout";
import ParkingApproved, { type ParkingApprovedProps } from "../../../emails/parking-approved";
import ParkingRejected, { type ParkingRejectedProps } from "../../../emails/parking-rejected";
import PasswordReset, { type PasswordResetProps } from "../../../emails/password-reset";
import PaymentFailed, { type PaymentFailedProps } from "../../../emails/payment-failed";
import type { EmailAttachment } from "./provider";

export type NotificationPayloads = {
  "booking-confirmed": BookingConfirmedProps;
  "booking-reminder": BookingReminderProps;
  "booking-cancelled": BookingCancelledProps;
  "payment-failed": PaymentFailedProps;
  "host-event-prompt": HostEventPromptProps;
  "host-payout": HostPayoutProps;
  "parking-approved": ParkingApprovedProps;
  "parking-rejected": ParkingRejectedProps;
  "password-reset": PasswordResetProps;
  "data-export": DataExportProps;
};

export type TemplateId = keyof NotificationPayloads;

type Template<K extends TemplateId> = {
  subject: (payload: NotificationPayloads[K]) => string;
  email: (payload: NotificationPayloads[K]) => ReactElement;
  attachments?: (payload: NotificationPayloads[K]) => Promise<EmailAttachment[]>;
  /**
   * Only two templates may ever define this. An SMS costs 0.08–0.12 zł against a
   * ~6 zł commission (docs/RISKS.md R16): it buys us a code in the hand of someone
   * standing at a barrier, and nothing else is worth the money.
   */
  sms?: (payload: NotificationPayloads[K]) => string;
  /**
   * true  — send at most once per (user, template, relatedId); a repeat is a no-op.
   *         The host must not be invited to the same event twice.
   * false — a repeat is allowed (a payment can fail twice, a parking can be rejected
   *         twice); the log row is overwritten rather than duplicated, because the
   *         unique key in the schema leaves no room for a second row.
   */
  dedupe: boolean;
};

const QR_CID = "qr";

async function bookingQr(code: string): Promise<EmailAttachment[]> {
  const png = await QRCode.toBuffer(code, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    color: { dark: "#191A1C", light: "#FFFFFF" },
  });

  return [
    {
      filename: `parkspot-${code}.png`,
      contentType: "image/png",
      content: png.toString("base64"),
      contentId: QR_CID,
    },
  ];
}

/** Hosts usually write "Wjazd od ul. Górczyńskiej" themselves — do not label it twice. */
function entranceLine(notes: string | null | undefined): string {
  if (!notes) return "";
  const trimmed = notes.trim().replace(/\.$/, "");
  return /^wjazd/i.test(trimmed) ? `${trimmed}.` : `Wjazd: ${trimmed}.`;
}

export const templates: { [K in TemplateId]: Template<K> } = {
  "booking-confirmed": {
    subject: (p) => `Twoja rezerwacja: ${p.code}`,
    email: (p) => createElement(BookingConfirmed, { ...p, qrCid: QR_CID }),
    attachments: (p) => bookingQr(p.code),
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
    subject: (p) => `Za 2 godziny: ${p.parkingTitle}`,
    email: (p) => createElement(BookingReminder, p),
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
    subject: (p) => `Rezerwacja ${p.code} anulowana`,
    email: (p) => createElement(BookingCancelled, p),
    dedupe: true,
  },

  "payment-failed": {
    subject: () => "Płatność nie przeszła",
    email: (p) => createElement(PaymentFailed, p),
    dedupe: false,
  },

  "host-event-prompt": {
    subject: (p) => `${p.eventTitle} — ${formatDatePL(p.eventStartsAt)}. Udostępnisz miejsca?`,
    email: (p) => createElement(HostEventPrompt, p),
    dedupe: true,
  },

  "host-payout": {
    subject: (p) => `Wypłata ${formatMoney(p.amountGr)}`,
    email: (p) => createElement(HostPayout, p),
    dedupe: true,
  },

  "parking-approved": {
    subject: (p) => `${p.parkingTitle} jest na mapie`,
    email: (p) => createElement(ParkingApproved, p),
    dedupe: true,
  },

  "parking-rejected": {
    subject: (p) => `Parking nie przeszedł weryfikacji: ${p.parkingTitle}`,
    email: (p) => createElement(ParkingRejected, p),
    dedupe: false,
  },

  "password-reset": {
    subject: () => "Ustaw nowe hasło",
    email: (p) => createElement(PasswordReset, p),
    dedupe: false,
  },

  "data-export": {
    subject: () => "Twoje dane są gotowe",
    email: (p) => createElement(DataExport, p),
    dedupe: false,
  },
};

