import { z } from "zod";

/**
 * Polish mobile numbers, normalised to E.164. Accepts what people actually type
 * ("601 234 567", "+48 601-234-567") and rejects what cannot receive an SMS with
 * a booking code.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .refine((value) => /^(\+48)?\d{9}$/.test(value), {
    message: "Podaj polski numer telefonu — 9 cyfr.",
  })
  .transform((value) => (value.startsWith("+48") ? value : `+48${value}`));

export const plateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "Numer rejestracyjny jest za krótki.")
  .max(12, "Numer rejestracyjny jest za długi.")
  .regex(/^[A-Z0-9 ]+$/, "Numer rejestracyjny zawiera niedozwolone znaki.");

/**
 * RODO is not optional (CLAUDE.md). The account created "along the way" during
 * checkout is still an account, so the two required consents are collected on
 * the payment screen and versioned.
 */
export const consentsSchema = z.object({
  terms: z.literal(true, { message: "Regulamin trzeba zaakceptować, żeby zarezerwować miejsce." }),
  privacy: z.literal(true, { message: "Zgoda na przetwarzanie danych jest wymagana." }),
  marketingEmail: z.boolean().optional().default(false),
});

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.datetime());

export const createBookingSchema = z
  .object({
    parkingId: z.uuid("Nieprawidłowy parking."),
    eventId: z.uuid().nullish(),
    startsAt: isoDate.nullish(),
    endsAt: isoDate.nullish(),
    spots: z.number().int().min(1).max(10).default(1),
    vehiclePlate: plateSchema.nullish(),
    contact: z.object({
      email: z.email("Podaj poprawny adres e-mail."),
      phone: phoneSchema,
    }),
    consents: consentsSchema,
  })
  // Either an event or a from–to window. Both, or neither, is a bug in the
  // caller — and the server never guesses which one the driver meant.
  .refine((input) => Boolean(input.eventId) !== Boolean(input.startsAt && input.endsAt), {
    message: "Wybierz wydarzenie albo zakres godzin.",
    path: ["eventId"],
  });

export type CreateBookingRequest = z.infer<typeof createBookingSchema>;

export const paymentIntentSchema = z.object({
  bookingId: z.uuid(),
  method: z.enum(["BLIK", "CARD"]),
});

export type PaymentIntentRequest = z.infer<typeof paymentIntentSchema>;

/** Anything the client sends that looks like money is ignored — there is no field for it. */
export const bookingIdSchema = z.object({ id: z.uuid() });
