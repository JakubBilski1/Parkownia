import { relations, sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { geographyPoint } from "./geo";

const citext = customType<{ data: string; driverData: string }>({
  dataType() {
    return "citext";
  },
});

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* -------------------------------------------------------------------------- */
/* Enums                                                                      */
/* -------------------------------------------------------------------------- */

export const roleEnum = pgEnum("role", ["DRIVER", "HOST_INDIVIDUAL", "HOST_BUSINESS", "ADMIN"]);

export const consentKindEnum = pgEnum("consent_kind", [
  "TERMS",
  "PRIVACY",
  "MARKETING_EMAIL",
  "MARKETING_SMS",
]);

export const actionTokenPurposeEnum = pgEnum("action_token_purpose", [
  "EVENT_AVAILABILITY",
  "EMAIL_VERIFY",
  "PASSWORD_RESET",
  "DATA_EXPORT",
]);

export const ownerTypeEnum = pgEnum("owner_type", ["INDIVIDUAL", "BUSINESS"]);

export const parkingStatusEnum = pgEnum("parking_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "ACTIVE",
  "PAUSED",
  "REJECTED",
]);

export const parkingTypeEnum = pgEnum("parking_type", [
  "OUTDOOR_LOT",
  "UNDERGROUND",
  "GARAGE",
  "DRIVEWAY",
  "STREET_ADJACENT",
  "MULTI_STOREY",
]);

export const accessTypeEnum = pgEnum("access_type", [
  "OPEN",
  "BARRIER_CODE",
  "BARRIER_REMOTE",
  "GATE_MANUAL",
  "LPR",
  "KEY_HANDOVER",
  "ATTENDANT",
]);

export const surfaceEnum = pgEnum("surface", [
  "ASPHALT",
  "PAVING",
  "CONCRETE",
  "GRAVEL",
  "GRASS",
  "DIRT",
]);

export const vehicleTypeEnum = pgEnum("vehicle_type", [
  "CAR",
  "SUV",
  "VAN",
  "MOTORCYCLE",
  "CAMPER",
  "TRAILER",
  "BICYCLE",
]);

export const evConnectorTypeEnum = pgEnum("ev_connector_type", [
  "TYPE2",
  "CCS",
  "CHADEMO",
  "SCHUKO",
]);

export const availabilityModeEnum = pgEnum("availability_mode", [
  "ALWAYS",
  "RECURRING_SCHEDULE",
  "EVENT_ONLY",
  "MANUAL",
]);

export const eventCategoryEnum = pgEnum("event_category", [
  "FOOTBALL",
  "CONCERT",
  "TRADE_FAIR",
  "SPORTS",
  "FESTIVAL",
  "OTHER",
]);

export const bookingStatusEnum = pgEnum("booking_status", [
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
  "USED",
  "NO_SHOW",
]);

export const scanResultEnum = pgEnum("scan_result", [
  "ADMITTED",
  "REJECTED_USED",
  "REJECTED_INVALID",
  "REJECTED_TIME",
]);

export const paymentProviderEnum = pgEnum("payment_provider", [
  "MANUAL",
  "STRIPE",
  "P24",
  "AUTOPAY",
]);

export const paymentMethodEnum = pgEnum("payment_method", ["BLIK", "CARD"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "INITIATED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

export const payoutStatusEnum = pgEnum("payout_status", ["PENDING", "PAID", "FAILED"]);

export const commissionScopeEnum = pgEnum("commission_scope", [
  "GLOBAL_INDIVIDUAL",
  "GLOBAL_BUSINESS",
  "USER",
  "PARKING",
]);

export const notificationChannelEnum = pgEnum("notification_channel", ["EMAIL", "SMS"]);

export const notificationStatusEnum = pgEnum("notification_status", ["SENT", "FAILED"]);

// Supply-acquisition leads (the landing at /). Object type mirrors the
// Polish copy: plac, podjazd, parking firmowy, garaż/podziemie, inne.
export const leadObjectTypeEnum = pgEnum("lead_object_type", [
  "LOT",
  "DRIVEWAY",
  "COMPANY_LOT",
  "GARAGE",
  "OTHER",
]);

export const leadContactPreferenceEnum = pgEnum("lead_contact_preference", ["PHONE", "EMAIL"]);

export const leadStatusEnum = pgEnum("lead_status", [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "CONVERTED",
  "REJECTED",
  "SPAM",
]);

/* -------------------------------------------------------------------------- */
/* JSONB shapes                                                               */
/* -------------------------------------------------------------------------- */

export type ScheduleSlot = {
  from: string;
  to: string;
};

// Local Europe/Warsaw hours — a recurring schedule is a local concept ("after
// work"). Converted to UTC when availability is resolved in SQL.
export type WeeklySchedule = Partial<
  Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", ScheduleSlot[]>
>;

export type RefundRule = {
  minHoursBefore: number;
  refundPct: number;
};

export type Pkd = {
  code: string;
  name?: string;
  primary?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Users, roles, auth                                                         */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash"),
    firstName: text("first_name"),
    lastName: text("last_name"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),

    // Stripe Connect Express (docs/PAYMENTS.md §2.2). The destination of every
    // charge on this host's parkings; null until they start onboarding.
    stripeAccountId: text("stripe_account_id"),
    // Both flags are Stripe's answer, never ours: they are written only by the
    // account.updated webhook. `charges_enabled` gates taking money for this
    // host; `payouts_enabled` gates publishing their parking at all — selling a
    // spot we cannot pay the host for is a debt, not a sale.
    chargesEnabled: boolean("charges_enabled").notNull().default(false),
    payoutsEnabled: boolean("payouts_enabled").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("users_email_key").on(table.email),
    // The webhook arrives with an account id and nothing else — this is the
    // lookup that turns it into a user. Unique: one connected account, one host.
    uniqueIndex("users_stripe_account_id_key").on(table.stripeAccountId),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
    index("user_roles_role_idx").on(table.role),
  ],
);

export const businessProfiles = pgTable(
  "business_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    nip: char("nip", { length: 10 }).notNull(),
    companyName: text("company_name").notNull(),
    address: text("address"),
    vatStatus: text("vat_status"),
    whitelistCheckedAt: timestamp("whitelist_checked_at", { withTimezone: true }),
    whitelistBankAccounts: jsonb("whitelist_bank_accounts").$type<string[]>(),
    regon: text("regon"),
    legalForm: text("legal_form"),
    pkd: jsonb("pkd").$type<Pkd[]>(),
    ...timestamps,
  },
  (table) => [uniqueIndex("business_profiles_nip_key").on(table.nip)],
);

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    familyId: uuid("family_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_hash_key").on(table.tokenHash),
    index("refresh_tokens_user_id_idx").on(table.userId),
    index("refresh_tokens_family_id_idx").on(table.familyId),
  ],
);

export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: consentKindEnum("kind").notNull(),
    documentVersion: text("document_version").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [index("consents_user_id_kind_idx").on(table.userId, table.kind)],
);

export const actionTokens = pgTable(
  "action_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: actionTokenPurposeEnum("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("action_tokens_token_hash_key").on(table.tokenHash),
    index("action_tokens_user_id_purpose_idx").on(table.userId, table.purpose),
  ],
);

/* -------------------------------------------------------------------------- */
/* Parkings                                                                   */
/* -------------------------------------------------------------------------- */

export const parkings = pgTable(
  "parkings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ownerType: ownerTypeEnum("owner_type").notNull(),
    status: parkingStatusEnum("status").notNull().default("DRAFT"),
    rejectionReason: text("rejection_reason"),
    title: text("title"),
    description: text("description"),
    location: geographyPoint("location"),
    address: text("address"),
    capacity: integer("capacity"),
    parkingType: parkingTypeEnum("parking_type"),
    accessType: accessTypeEnum("access_type"),
    // Never served to a client before that client's booking is CONFIRMED
    // (docs/API_SPEC.md §3) — the column is public-facing only after payment.
    accessInstructions: text("access_instructions"),
    entranceLocation: geographyPoint("entrance_location"),
    entranceNotes: text("entrance_notes"),
    surface: surfaceEnum("surface"),
    isCovered: boolean("is_covered"),
    isGuarded: boolean("is_guarded"),
    hasCctv: boolean("has_cctv"),
    isLit: boolean("is_lit"),
    isFenced: boolean("is_fenced"),
    maxVehicleHeightCm: integer("max_vehicle_height_cm"),
    maxVehicleLengthCm: integer("max_vehicle_length_cm"),
    vehicleTypes: vehicleTypeEnum("vehicle_types").array(),
    hasEvCharging: boolean("has_ev_charging"),
    evConnectorTypes: evConnectorTypeEnum("ev_connector_types").array(),
    hasDisabledAccess: boolean("has_disabled_access"),
    disabledSpotsCount: integer("disabled_spots_count"),
    availabilityMode: availabilityModeEnum("availability_mode").notNull().default("ALWAYS"),
    schedule: jsonb("schedule").$type<WeeklySchedule>(),
    pricePerHourGr: integer("price_per_hour_gr"),
    pricePerDayGr: integer("price_per_day_gr"),
    pricePerMonthGr: integer("price_per_month_gr"),
    pricePerEventGr: integer("price_per_event_gr"),
    minBookingMinutes: integer("min_booking_minutes").notNull().default(30),
    freeMinutes: integer("free_minutes").notNull().default(0),
    payoutBankAccount: text("payout_bank_account"),
    profileCompleteness: integer("profile_completeness").notNull().default(0),
    deletedOwner: boolean("deleted_owner").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("parkings_location_gist_idx").using("gist", sql`${table.location}`),
    index("parkings_entrance_location_gist_idx").using("gist", sql`${table.entranceLocation}`),
    index("parkings_status_idx").on(table.status),
    index("parkings_owner_id_idx").on(table.ownerId),
    index("parkings_moderation_queue_idx")
      .on(table.createdAt)
      .where(sql`${table.status} = 'PENDING_REVIEW'`),
    check("parkings_capacity_positive", sql`${table.capacity} IS NULL OR ${table.capacity} > 0`),
    check(
      "parkings_profile_completeness_range",
      sql`${table.profileCompleteness} BETWEEN 0 AND 100`,
    ),
  ],
);

export const parkingPhotos = pgTable(
  "parking_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parkingId: uuid("parking_id")
      .notNull()
      .references(() => parkings.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    ...timestamps,
  },
  (table) => [index("parking_photos_parking_id_idx").on(table.parkingId, table.sortOrder)],
);

export const parkingAvailabilityWindows = pgTable(
  "parking_availability_windows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parkingId: uuid("parking_id")
      .notNull()
      .references(() => parkings.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    spots: integer("spots"),
    ...timestamps,
  },
  (table) => [
    index("parking_availability_windows_range_idx").on(
      table.parkingId,
      table.startsAt,
      table.endsAt,
    ),
    check("parking_availability_windows_range", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const parkingBlackoutDates = pgTable(
  "parking_blackout_dates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parkingId: uuid("parking_id")
      .notNull()
      .references(() => parkings.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    reason: text("reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("parking_blackout_dates_parking_id_date_key").on(table.parkingId, table.date),
  ],
);

/* -------------------------------------------------------------------------- */
/* Venues and events                                                          */
/* -------------------------------------------------------------------------- */

export const venues = pgTable(
  "venues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    address: text("address"),
    location: geographyPoint("location").notNull(),
    capacity: integer("capacity"),
    ...timestamps,
  },
  (table) => [
    index("venues_location_gist_idx").using("gist", sql`${table.location}`),
    uniqueIndex("venues_name_key").on(table.name),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    venueId: uuid("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    category: eventCategoryEnum("category").notNull().default("OTHER"),
    expectedAttendance: integer("expected_attendance"),
    searchRadiusMeters: integer("search_radius_meters").notNull().default(1500),
    ...timestamps,
  },
  (table) => [
    index("events_starts_at_idx").on(table.startsAt),
    // Natural key — lets the seed re-run without duplicating events.
    uniqueIndex("events_venue_title_starts_at_key").on(table.venueId, table.title, table.startsAt),
    check("events_range", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const eventParkingAvailability = pgTable(
  "event_parking_availability",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    parkingId: uuid("parking_id")
      .notNull()
      .references(() => parkings.id, { onDelete: "cascade" }),
    isAvailable: boolean("is_available").notNull(),
    spots: integer("spots"),
    priceGr: integer("price_gr"),
    notes: text("notes"),
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.eventId, table.parkingId] }),
    index("event_parking_availability_parking_id_idx").on(table.parkingId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Commission and refund rules                                                */
/* -------------------------------------------------------------------------- */

export const commissionRules = pgTable(
  "commission_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: commissionScopeEnum("scope").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    parkingId: uuid("parking_id").references(() => parkings.id, { onDelete: "cascade" }),
    ratePct: integer("rate_pct").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("commission_rules_scope_valid_from_idx").on(table.scope, table.validFrom),
    index("commission_rules_user_id_idx").on(table.userId),
    index("commission_rules_parking_id_idx").on(table.parkingId),
    check("commission_rules_rate_range", sql`${table.ratePct} BETWEEN 0 AND 100`),
    check(
      "commission_rules_scope_target",
      sql`(${table.scope} = 'USER' AND ${table.userId} IS NOT NULL AND ${table.parkingId} IS NULL)
        OR (${table.scope} = 'PARKING' AND ${table.parkingId} IS NOT NULL AND ${table.userId} IS NULL)
        OR (${table.scope} IN ('GLOBAL_INDIVIDUAL', 'GLOBAL_BUSINESS') AND ${table.userId} IS NULL AND ${table.parkingId} IS NULL)`,
    ),
  ],
);

export const refundPolicies = pgTable(
  "refund_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    rules: jsonb("rules").$type<RefundRule[]>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("refund_policies_name_valid_from_key").on(table.name, table.validFrom),
    index("refund_policies_default_idx")
      .on(table.validFrom)
      .where(sql`${table.isDefault}`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Bookings                                                                   */
/* -------------------------------------------------------------------------- */

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    // sha256(code) — the hash, never the code, is what ships in offline manifests.
    codeHash: text("code_hash").notNull(),
    parkingId: uuid("parking_id")
      .notNull()
      .references(() => parkings.id, { onDelete: "restrict" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    eventId: uuid("event_id").references(() => events.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    spots: integer("spots").notNull().default(1),
    status: bookingStatusEnum("status").notNull().default("PENDING"),
    priceGr: integer("price_gr").notNull(),
    // Frozen at booking time: a later rule change must not rewrite settled money.
    commissionRatePct: integer("commission_rate_pct").notNull(),
    commissionGr: integer("commission_gr").notNull(),
    hostPayoutGr: integer("host_payout_gr").notNull(),
    refundPolicyId: uuid("refund_policy_id")
      .notNull()
      .references(() => refundPolicies.id, { onDelete: "restrict" }),
    vehiclePlate: text("vehicle_plate"),
    pendingExpiresAt: timestamp("pending_expires_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    refundGr: integer("refund_gr"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("bookings_code_key").on(table.code),
    index("bookings_code_hash_idx").on(table.codeHash),
    // USED belongs here: a car that is already inside occupies the most occupied
    // spot there is. The occupancy query counts PENDING + CONFIRMED + USED, and a
    // partial index whose predicate does not cover the query is an index Postgres
    // will not use — this is the hot path that stops the same spot selling twice.
    index("bookings_occupancy_idx")
      .on(table.parkingId, table.startsAt, table.endsAt)
      .where(sql`${table.status} IN ('PENDING', 'CONFIRMED', 'USED')`),
    index("bookings_user_id_idx").on(table.userId),
    index("bookings_event_id_idx").on(table.eventId),
    check("bookings_spots_positive", sql`${table.spots} > 0`),
    check("bookings_range", sql`${table.endsAt} > ${table.startsAt}`),
    check(
      "bookings_money_split",
      sql`${table.commissionGr} + ${table.hostPayoutGr} = ${table.priceGr}`,
    ),
  ],
);

export const bookingScans = pgTable(
  "booking_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    scannedBy: uuid("scanned_by").references(() => users.id, { onDelete: "set null" }),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true }),
    result: scanResultEnum("result").notNull(),
    offline: boolean("offline").notNull().default(false),
    deviceId: text("device_id"),
    conflict: boolean("conflict").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    index("booking_scans_booking_id_idx").on(table.bookingId, table.scannedAt),
    // Idempotency key of POST /api/scan/sync — replaying an offline batch is a no-op.
    unique("booking_scans_idempotency_key")
      .on(table.bookingId, table.deviceId, table.scannedAt)
      .nullsNotDistinct(),
  ],
);

/* -------------------------------------------------------------------------- */
/* Payments and payouts                                                       */
/* -------------------------------------------------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    provider: paymentProviderEnum("provider").notNull(),
    providerRef: text("provider_ref"),
    method: paymentMethodEnum("method"),
    amountGr: integer("amount_gr").notNull(),
    status: paymentStatusEnum("status").notNull().default("INITIATED"),
    refundedGr: integer("refunded_gr").notNull().default(0),
    failedReason: text("failed_reason"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("payments_booking_id_key").on(table.bookingId),
    index("payments_provider_ref_idx").on(table.provider, table.providerRef),
    check(
      "payments_refunded_within_amount",
      sql`${table.refundedGr} BETWEEN 0 AND ${table.amountGr}`,
    ),
  ],
);

export const webhookEvents = pgTable(
  "webhook_events",
  {
    provider: paymentProviderEnum("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    payloadHash: text("payload_hash"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  // Composite PK is the idempotency guarantee: a duplicate webhook cannot insert.
  (table) => [primaryKey({ columns: [table.provider, table.eventId] })],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    amountGr: integer("amount_gr").notNull().default(0),
    status: payoutStatusEnum("status").notNull().default("PENDING"),
    provider: paymentProviderEnum("provider").notNull().default("MANUAL"),
    providerRef: text("provider_ref"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("payouts_host_id_idx").on(table.hostId),
    index("payouts_status_idx").on(table.status),
    uniqueIndex("payouts_host_period_key").on(table.hostId, table.periodStart, table.periodEnd),
  ],
);

export const payoutItems = pgTable(
  "payout_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),
    amountGr: integer("amount_gr").notNull(),
    ...timestamps,
  },
  (table) => [
    // A booking is settled exactly once.
    uniqueIndex("payout_items_booking_id_key").on(table.bookingId),
    index("payout_items_payout_id_idx").on(table.payoutId),
  ],
);

/* -------------------------------------------------------------------------- */
/* Notifications, rate limiting                                               */
/* -------------------------------------------------------------------------- */

export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    channel: notificationChannelEnum("channel").notNull(),
    template: text("template").notNull(),
    relatedId: uuid("related_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    status: notificationStatusEnum("status").notNull(),
    ...timestamps,
  },
  (table) => [
    // Deduplication (never invite the same host to the same event twice).
    // NULLS NOT DISTINCT: related_id is NULL for account-level templates, and
    // Postgres would otherwise treat every NULL row as unique.
    unique("notification_log_dedup_key")
      .on(table.userId, table.template, table.relatedId)
      .nullsNotDistinct(),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
  ...timestamps,
});

/* -------------------------------------------------------------------------- */
/* Leads (supply acquisition — the landing at /)                              */
/* -------------------------------------------------------------------------- */

// A prospect who left their parking object through the acquisition landing.
// Not a user and not a host: no FK to users, no account. Personal data of a
// non-user (RODO applies) — consent is captured here, versioned like consents.
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: leadStatusEnum("status").notNull().default("NEW"),

    // The object being offered.
    objectName: text("object_name"),
    address: text("address").notNull(),
    // Nullable: set from geocoding the address or from a map click; a lead may
    // arrive before we resolve coordinates.
    location: geographyPoint("location"),
    objectType: leadObjectTypeEnum("object_type"),
    spotsDeclared: integer("spots_declared"),

    // Who to talk to.
    contactName: text("contact_name").notNull(),
    phone: text("phone"),
    email: citext("email"),
    contactPreference: leadContactPreferenceEnum("contact_preference").notNull(),

    // Snapshot of the estimate the owner saw, RECOMPUTED on the server at submit
    // (never trusted from the client) — context for the sales conversation.
    estimatedRateGr: integer("estimated_rate_gr"),
    estimatedAnnualGrossGr: integer("estimated_annual_gross_gr"),
    eventsInReach: integer("events_in_reach"),
    walkMinutesEnea: integer("walk_minutes_enea"),
    walkMinutesMtp: integer("walk_minutes_mtp"),

    // RODO: consent captured at submission. privacy_consent_version pins the
    // privacy-policy version in force at the time (see CONSENT_VERSIONS).
    // Marketing is split per channel (PKE art. 398 needs a separate consent for
    // each); SMS is intentionally absent — the landing markets by e-mail and phone.
    privacyConsent: boolean("privacy_consent").notNull().default(false),
    privacyConsentVersion: text("privacy_consent_version"),
    marketingEmailConsent: boolean("marketing_email_consent").notNull().default(false),
    marketingPhoneConsent: boolean("marketing_phone_consent").notNull().default(false),

    // Provenance / anti-abuse.
    source: text("source"),
    userAgent: text("user_agent"),

    ...timestamps,
  },
  (table) => [
    index("leads_status_idx").on(table.status),
    index("leads_created_at_idx").on(table.createdAt),
    index("leads_location_gist_idx").using("gist", sql`${table.location}`),
    // We cannot follow up on a lead with no way to reach them.
    check("leads_contact_present", sql`${table.phone} is not null or ${table.email} is not null`),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations                                                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ one, many }) => ({
  roles: many(userRoles),
  businessProfile: one(businessProfiles, {
    fields: [users.id],
    references: [businessProfiles.userId],
  }),
  refreshTokens: many(refreshTokens),
  consents: many(consents),
  actionTokens: many(actionTokens),
  parkings: many(parkings),
  bookings: many(bookings),
  payouts: many(payouts),
  notifications: many(notificationLog),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}));

export const businessProfilesRelations = relations(businessProfiles, ({ one }) => ({
  user: one(users, { fields: [businessProfiles.userId], references: [users.id] }),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  user: one(users, { fields: [consents.userId], references: [users.id] }),
}));

export const actionTokensRelations = relations(actionTokens, ({ one }) => ({
  user: one(users, { fields: [actionTokens.userId], references: [users.id] }),
}));

export const parkingsRelations = relations(parkings, ({ one, many }) => ({
  owner: one(users, { fields: [parkings.ownerId], references: [users.id] }),
  photos: many(parkingPhotos),
  availabilityWindows: many(parkingAvailabilityWindows),
  blackoutDates: many(parkingBlackoutDates),
  eventAvailability: many(eventParkingAvailability),
  bookings: many(bookings),
}));

export const parkingPhotosRelations = relations(parkingPhotos, ({ one }) => ({
  parking: one(parkings, { fields: [parkingPhotos.parkingId], references: [parkings.id] }),
}));

export const parkingAvailabilityWindowsRelations = relations(
  parkingAvailabilityWindows,
  ({ one }) => ({
    parking: one(parkings, {
      fields: [parkingAvailabilityWindows.parkingId],
      references: [parkings.id],
    }),
  }),
);

export const parkingBlackoutDatesRelations = relations(parkingBlackoutDates, ({ one }) => ({
  parking: one(parkings, { fields: [parkingBlackoutDates.parkingId], references: [parkings.id] }),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  venue: one(venues, { fields: [events.venueId], references: [venues.id] }),
  parkingAvailability: many(eventParkingAvailability),
  bookings: many(bookings),
}));

export const eventParkingAvailabilityRelations = relations(eventParkingAvailability, ({ one }) => ({
  event: one(events, { fields: [eventParkingAvailability.eventId], references: [events.id] }),
  parking: one(parkings, {
    fields: [eventParkingAvailability.parkingId],
    references: [parkings.id],
  }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  parking: one(parkings, { fields: [bookings.parkingId], references: [parkings.id] }),
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  event: one(events, { fields: [bookings.eventId], references: [events.id] }),
  refundPolicy: one(refundPolicies, {
    fields: [bookings.refundPolicyId],
    references: [refundPolicies.id],
  }),
  payment: one(payments, { fields: [bookings.id], references: [payments.bookingId] }),
  scans: many(bookingScans),
  payoutItem: one(payoutItems, { fields: [bookings.id], references: [payoutItems.bookingId] }),
}));

export const bookingScansRelations = relations(bookingScans, ({ one }) => ({
  booking: one(bookings, { fields: [bookingScans.bookingId], references: [bookings.id] }),
  scanner: one(users, { fields: [bookingScans.scannedBy], references: [users.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  booking: one(bookings, { fields: [payments.bookingId], references: [bookings.id] }),
}));

export const payoutsRelations = relations(payouts, ({ one, many }) => ({
  host: one(users, { fields: [payouts.hostId], references: [users.id] }),
  items: many(payoutItems),
}));

export const payoutItemsRelations = relations(payoutItems, ({ one }) => ({
  payout: one(payouts, { fields: [payoutItems.payoutId], references: [payouts.id] }),
  booking: one(bookings, { fields: [payoutItems.bookingId], references: [bookings.id] }),
}));

export const commissionRulesRelations = relations(commissionRules, ({ one }) => ({
  user: one(users, { fields: [commissionRules.userId], references: [users.id] }),
  parking: one(parkings, { fields: [commissionRules.parkingId], references: [parkings.id] }),
}));

export const refundPoliciesRelations = relations(refundPolicies, ({ many }) => ({
  bookings: many(bookings),
}));

export const notificationLogRelations = relations(notificationLog, ({ one }) => ({
  user: one(users, { fields: [notificationLog.userId], references: [users.id] }),
}));
