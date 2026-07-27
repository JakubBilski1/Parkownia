import { z } from "zod";
import { phoneSchema } from "@/modules/bookings/schemas";

/**
 * An empty field means "clear this", not "reject this". The form sends what the
 * input holds, and a person who wipes their phone number is asking us to stop
 * holding it (RODO art. 5 — minimisation), not making a mistake.
 */
const clearable = <T extends z.ZodType>(inner: T) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    inner.nullable(),
  );

const nameSchema = z.string().trim().max(80, "To pole mieści 80 znaków.");

/**
 * RODO art. 16 — the right to have wrong data put right. Without this endpoint
 * there is no such right in the product: the checkout upsert keeps whatever
 * number is already on file (`COALESCE` in modules/bookings/service.ts), and the
 * booking notification reads the phone from the account rather than from the
 * order (modules/bookings/notify.ts). One typo at the first purchase would
 * otherwise be permanent.
 *
 * E-mail is deliberately not here. It is the login, and it is the address every
 * booking code goes to, so changing it has to be confirmed from the new inbox
 * before it takes effect — that is its own path with its own token, not a third
 * text input on this form.
 *
 * The single canonical definition of "a Polish phone number" lives in the
 * bookings module and is reused here on purpose: two definitions would drift,
 * and the checkout one is the one users have already met.
 */
export const updateProfileSchema = z
  .object({
    firstName: clearable(nameSchema).optional(),
    lastName: clearable(nameSchema).optional(),
    phone: clearable(phoneSchema).optional(),
  })
  .refine(
    (value) =>
      value.firstName !== undefined ||
      value.lastName !== undefined ||
      value.phone !== undefined,
    "Nie przesłano żadnej zmiany.",
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Only marketing consents are togglable. Terms and privacy are the condition of
 * having an account at all — withdrawing them means deleting the account
 * (DELETE /api/me), and pretending otherwise with a switch would be a lie.
 */
export const updateConsentsSchema = z
  .object({
    marketingEmail: z.boolean().optional(),
    marketingSms: z.boolean().optional(),
  })
  .refine(
    (value) => value.marketingEmail !== undefined || value.marketingSms !== undefined,
    "Nie przesłano żadnej zmiany.",
  );

export type UpdateConsentsInput = z.infer<typeof updateConsentsSchema>;
