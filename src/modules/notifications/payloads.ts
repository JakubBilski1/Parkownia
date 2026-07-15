/**
 * The payload each notification carries. This is the contract the callers
 * (bookings/notify.ts, auth/mailer.ts, admin/notifier.ts, events/reminders.ts,
 * the data-export route) build against — unchanged by the move to a
 * template-rendering mail API.
 *
 * Timestamps are ISO-8601 strings, NEVER pre-formatted. The data() builders in
 * templates.ts format them to Europe/Warsaw at the last moment (CLAUDE.md: time
 * stays UTC until the presentation layer). Handing a caller a formatted date is
 * the bug that once threw RangeError out of every booking mail.
 */

export type BookingConfirmedPayload = {
  firstName?: string | null;
  code: string;
  bookingId: string;
  parkingTitle: string;
  address: string;
  startsAt: string;
  endsAt: string;
  spots: number;
  priceGr: number;
  eventTitle?: string | null;
  entranceNotes?: string | null;
  entranceLat?: number | null;
  entranceLng?: number | null;
  /** Instructions are private until the booking is CONFIRMED (docs/API_SPEC.md §3). */
  accessInstructions?: string | null;
};

export type BookingReminderPayload = {
  firstName?: string | null;
  code: string;
  bookingId: string;
  parkingTitle: string;
  address: string;
  startsAt: string;
  entranceNotes?: string | null;
  entranceLat?: number | null;
  entranceLng?: number | null;
  accessInstructions?: string | null;
};

export type BookingCancelledPayload = {
  firstName?: string | null;
  code: string;
  parkingTitle: string;
  startsAt: string;
  priceGr: number;
  refundGr: number;
  /** Who pulled the trigger — the driver reads a different sentence than a host cancel. */
  cancelledBy: "DRIVER" | "HOST" | "ADMIN";
  /** Reason shown only when the driver did not cancel themselves. */
  reason?: string | null;
};

export type PaymentFailedPayload = {
  firstName?: string | null;
  bookingId: string;
  parkingTitle: string;
  priceGr: number;
  /** True only when money actually left the account and a refund is on its way. */
  charged: boolean;
  /** The PENDING booking dies at this moment and the spot goes back on sale. */
  holdExpiresAt?: string | null;
};

export type HostEventPromptPayload = {
  firstName?: string | null;
  eventTitle: string;
  eventStartsAt: string;
  venueName: string;
  parkingTitle: string;
  /** Straight-line metres from the venue; formatted with an "ok." hedge. */
  straightLineMeters: number;
  suggestedSpots: number;
  suggestedPriceGr: number;
  /** Net of commission, computed on the server. Never a guess in the template. */
  estimatedPayoutGr: number;
  /** Single-use action token (purpose EVENT_AVAILABILITY) — works without logging in. */
  actionToken: string;
};

export type HostPayoutPayload = {
  firstName?: string | null;
  amountGr: number;
  bookingsCount: number;
  periodStart: string;
  periodEnd: string;
  /** Last four digits only — the full IBAN never leaves the database. */
  accountLast4?: string | null;
};

export type ParkingApprovedPayload = {
  firstName?: string | null;
  parkingId: string;
  parkingTitle: string;
  /** Nearest event within the parking's radius, if there is one — this is the hook. */
  nextEvent?: { title: string; startsAt: string; venueName: string } | null;
};

export type ParkingRejectedPayload = {
  firstName?: string | null;
  parkingId: string;
  parkingTitle: string;
  /** Required by the API (422 without it) — a rejection without a reason is a dead end. */
  reason: string;
};

export type PasswordResetPayload = {
  firstName?: string | null;
  /** Single-use action token (purpose PASSWORD_RESET). */
  actionToken: string;
  expiresInMinutes: number;
};

export type DataExportPayload = {
  firstName?: string | null;
  /** Single-use action token (purpose DATA_EXPORT), valid 24 h (docs/API_SPEC.md §10). */
  actionToken: string;
  expiresAt: string;
};

export type NotificationPayloads = {
  "booking-confirmed": BookingConfirmedPayload;
  "booking-reminder": BookingReminderPayload;
  "booking-cancelled": BookingCancelledPayload;
  "payment-failed": PaymentFailedPayload;
  "host-event-prompt": HostEventPromptPayload;
  "host-payout": HostPayoutPayload;
  "parking-approved": ParkingApprovedPayload;
  "parking-rejected": ParkingRejectedPayload;
  "password-reset": PasswordResetPayload;
  "data-export": DataExportPayload;
};

export type TemplateId = keyof NotificationPayloads;
