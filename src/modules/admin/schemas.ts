import { z } from "zod";

/**
 * Every admin entry point — API route and server action alike — parses its input
 * with one of these. The module functions do the parsing themselves, so neither
 * path can skip it.
 */

const uuid = z.uuid({ message: "Niepoprawny identyfikator." });

const cursorLimit = {
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

/** ISO date or datetime coming from a query string or a form field. */
const dateInput = z.coerce.date({ message: "Niepoprawna data." });

/* -------------------------------------------------------------------------- */
/* Moderation                                                                 */
/* -------------------------------------------------------------------------- */

export const moderationQueueSchema = z.object({
  status: z
    .enum(["PENDING_REVIEW", "ACTIVE", "REJECTED", "PAUSED", "DRAFT"])
    .default("PENDING_REVIEW"),
  ...cursorLimit,
});
export type ModerationQueueInput = z.infer<typeof moderationQueueSchema>;

export const reviewParkingSchema = z.object({
  parkingId: uuid,
  decision: z.enum(["ACTIVE", "REJECTED"]),
  // Not required at the schema level on purpose: a missing reason on REJECTED is
  // a business-rule failure (422), not a malformed request (400) — API_SPEC §9.
  reason: z.string().trim().min(1).max(1000).optional(),
});
export type ReviewParkingInput = z.infer<typeof reviewParkingSchema>;

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export const dashboardSchema = z
  .object({
    from: dateInput.optional(),
    to: dateInput.optional(),
  })
  .refine((value) => !value.from || !value.to || value.to >= value.from, {
    message: "Data „do” nie może być wcześniejsza niż „od”.",
    path: ["to"],
  });
export type DashboardInput = z.infer<typeof dashboardSchema>;

/* -------------------------------------------------------------------------- */
/* Commissions                                                                */
/* -------------------------------------------------------------------------- */

export const commissionRuleSchema = z
  .object({
    scope: z.enum(["GLOBAL_INDIVIDUAL", "GLOBAL_BUSINESS", "USER", "PARKING"]),
    userId: uuid.optional(),
    parkingId: uuid.optional(),
    ratePct: z.coerce
      .number()
      .int({ message: "Stawka musi być liczbą całkowitą." })
      .min(0, { message: "Stawka nie może być ujemna." })
      .max(100, { message: "Stawka nie może przekraczać 100%." }),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "USER" && !value.userId) {
      ctx.addIssue({ code: "custom", path: ["userId"], message: "Wskaż użytkownika." });
    }
    if (value.scope === "PARKING" && !value.parkingId) {
      ctx.addIssue({ code: "custom", path: ["parkingId"], message: "Wskaż parking." });
    }
    if (value.scope !== "USER" && value.userId) {
      ctx.addIssue({ code: "custom", path: ["userId"], message: "Ten zakres nie ma użytkownika." });
    }
    if (value.scope !== "PARKING" && value.parkingId) {
      ctx.addIssue({ code: "custom", path: ["parkingId"], message: "Ten zakres nie ma parkingu." });
    }
  });
export type CommissionRuleInput = z.infer<typeof commissionRuleSchema>;

export const deleteCommissionRuleSchema = z.object({ ruleId: uuid });

/* -------------------------------------------------------------------------- */
/* Transactions and refunds                                                   */
/* -------------------------------------------------------------------------- */

export const transactionsSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "EXPIRED", "USED", "NO_SHOW"]).optional(),
  from: dateInput.optional(),
  to: dateInput.optional(),
  /** Booking code or e-mail fragment. */
  q: z.string().trim().min(2).max(120).optional(),
  parkingId: uuid.optional(),
  hostId: uuid.optional(),
  ...cursorLimit,
});
export type TransactionsInput = z.infer<typeof transactionsSchema>;

export const refundSchema = z.object({
  bookingId: uuid,
  /** Grosze. Omitted = refund everything that is still refundable. */
  amountGr: z.coerce.number().int().positive().optional(),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type RefundInput = z.infer<typeof refundSchema>;

/* -------------------------------------------------------------------------- */
/* Payouts                                                                    */
/* -------------------------------------------------------------------------- */

export const payoutReportSchema = z.object({
  status: z.enum(["PENDING", "PAID", "FAILED"]).default("PENDING"),
});
export type PayoutReportInput = z.infer<typeof payoutReportSchema>;

/** Calendar dates (no time): a payout period is a local, human week. */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Data musi mieć format RRRR-MM-DD." });

export const generatePayoutsSchema = z
  .object({
    periodStart: isoDate,
    periodEnd: isoDate,
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "Koniec okresu nie może wypadać przed jego początkiem.",
    path: ["periodEnd"],
  });
export type GeneratePayoutsInput = z.infer<typeof generatePayoutsSchema>;

export const markPaidSchema = z.object({
  payoutId: uuid,
  providerRef: z.string().trim().min(1, { message: "Podaj numer przelewu." }).max(120),
});
export type MarkPaidInput = z.infer<typeof markPaidSchema>;

/* -------------------------------------------------------------------------- */
/* Leads (supply acquisition — the landing at /)                              */
/* -------------------------------------------------------------------------- */

const leadStatus = z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "REJECTED", "SPAM"]);

export const leadsQuerySchema = z.object({
  status: leadStatus.optional(),
  /** Contact name, address, phone or e-mail fragment. */
  q: z.string().trim().min(2).max(120).optional(),
  ...cursorLimit,
});
export type LeadsQueryInput = z.infer<typeof leadsQuerySchema>;

export const setLeadStatusSchema = z.object({
  leadId: uuid,
  status: leadStatus,
});
export type SetLeadStatusInput = z.infer<typeof setLeadStatusSchema>;

/* -------------------------------------------------------------------------- */
/* Clients and their staff                                                    */
/* -------------------------------------------------------------------------- */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: "Podaj adres e-mail." })
  .max(160)
  .email({ message: "To nie jest poprawny adres e-mail." });

const personName = z.string().trim().min(1).max(80);

/**
 * A phone number as a human types it. Kept loose on purpose — a client dictates
 * "600 100 200" over the phone and an admin should not have to reformat it.
 */
const phone = z.string().trim().min(6, { message: "Numer jest za krótki." }).max(30);

export const clientsQuerySchema = z.object({
  /** Name, company, e-mail or phone fragment. */
  q: z.string().trim().min(2).max(120).optional(),
  kind: z.enum(["INDIVIDUAL", "BUSINESS"]).optional(),
  /** Soft-deleted clients are hidden unless asked for. */
  includeDeleted: z
    .union([z.boolean(), z.enum(["true", "false", "on"])])
    .transform((value) => value === true || value === "true" || value === "on")
    .default(false),
  ...cursorLimit,
});
export type ClientsQueryInput = z.infer<typeof clientsQuerySchema>;

export const createClientSchema = z
  .object({
    email,
    firstName: personName.optional(),
    lastName: personName.optional(),
    phone: phone.optional(),
    kind: z.enum(["INDIVIDUAL", "BUSINESS"]),
    // Business only. NIP is 10 digits; spaces and dashes are stripped first.
    nip: z
      .string()
      .trim()
      .transform((value) => value.replace(/[\s-]/g, ""))
      .pipe(z.string().regex(/^\d{10}$/, { message: "NIP ma 10 cyfr." }))
      .optional(),
    companyName: z.string().trim().min(2).max(200).optional(),
    address: z.string().trim().max(240).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "BUSINESS") return;
    // A business host without a company name is an invoice nobody can issue.
    if (!value.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Podaj nazwę firmy." });
    }
    if (!value.nip) {
      ctx.addIssue({ code: "custom", path: ["nip"], message: "Podaj NIP." });
    }
  });
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.object({
  clientId: uuid,
  firstName: personName.optional(),
  lastName: personName.optional(),
  phone: phone.optional(),
  /** Empty string clears the number — undefined leaves it alone. */
  clearPhone: z.coerce.boolean().optional(),
  companyName: z.string().trim().min(2).max(200).optional(),
  address: z.string().trim().max(240).optional(),
});
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const clientIdSchema = z.object({ clientId: uuid });

export const createEmployeeSchema = z.object({
  clientId: uuid,
  email,
  firstName: personName.optional(),
  lastName: personName.optional(),
  phone: phone.optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const employeeIdSchema = z.object({ employeeId: uuid });

/* -------------------------------------------------------------------------- */
/* Venues and events                                                          */
/* -------------------------------------------------------------------------- */

const latitude = z.coerce.number().min(-90).max(90);
const longitude = z.coerce.number().min(-180).max(180);

export const createVenueSchema = z.object({
  name: z.string().trim().min(2, { message: "Podaj nazwę obiektu." }).max(120),
  address: z.string().trim().max(240).optional(),
  lat: latitude,
  lng: longitude,
  capacity: z.coerce.number().int().positive().optional(),
});
export type CreateVenueInput = z.infer<typeof createVenueSchema>;

export const updateVenueSchema = createVenueSchema.partial().extend({ venueId: uuid });
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;

export const createEventSchema = z
  .object({
    venueId: uuid,
    title: z.string().trim().min(3, { message: "Podaj nazwę wydarzenia." }).max(160),
    description: z.string().trim().max(2000).optional(),
    startsAt: dateInput,
    endsAt: dateInput,
    category: z
      .enum(["FOOTBALL", "CONCERT", "TRADE_FAIR", "SPORTS", "FESTIVAL", "OTHER"])
      .default("OTHER"),
    expectedAttendance: z.coerce.number().int().positive().optional(),
    searchRadiusMeters: z.coerce.number().int().min(200).max(10000).default(1500),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "Koniec wydarzenia musi wypadać po jego początku.",
    path: ["endsAt"],
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    eventId: uuid,
    venueId: uuid.optional(),
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    startsAt: dateInput.optional(),
    endsAt: dateInput.optional(),
    category: z
      .enum(["FOOTBALL", "CONCERT", "TRADE_FAIR", "SPORTS", "FESTIVAL", "OTHER"])
      .optional(),
    expectedAttendance: z.coerce.number().int().positive().optional(),
    searchRadiusMeters: z.coerce.number().int().min(200).max(10000).optional(),
  })
  .refine((value) => !value.startsAt || !value.endsAt || value.endsAt > value.startsAt, {
    message: "Koniec wydarzenia musi wypadać po jego początku.",
    path: ["endsAt"],
  });
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const eventListSchema = z.object({
  upcoming: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .transform((value) => value === true || value === "true")
    .default(false),
  ...cursorLimit,
});
export type EventListInput = z.infer<typeof eventListSchema>;

export const idSchema = z.object({ id: uuid });
