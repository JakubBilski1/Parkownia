import { z } from "zod";
import { isValidNip, normalizeNip } from "./nip";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./policy";

/**
 * The same schemas validate the form in the browser and the request on the
 * server. The server copy is the one that counts — the browser copy exists so
 * the user learns about a mistake while typing, not after submitting.
 */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Podaj poprawny adres e-mail."));

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`)
  .max(PASSWORD_MAX_LENGTH, "Hasło jest za długie.");

const nameSchema = z.string().trim().min(1).max(80).optional();

/** E.164 — the SMS gateway will not accept anything else. */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Podaj numer w formacie +48123456789.")
  .optional();

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema,
  phone: phoneSchema,
  consents: z.object({
    terms: z.literal(true, "Bez akceptacji regulaminu nie założymy konta."),
    privacy: z.literal(true, "Bez zgody na przetwarzanie danych nie założymy konta."),
    marketingEmail: z.boolean().default(false),
    marketingSms: z.boolean().default(false),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // Not `passwordSchema`: an old account may hold a shorter password, and the
  // login form must not leak the current policy by rejecting it client-side.
  password: z.string().min(1, "Podaj hasło.").max(PASSWORD_MAX_LENGTH),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export const upgradeToHostSchema = z.object({
  hostType: z.literal("INDIVIDUAL"),
});

export const nipSchema = z
  .string()
  .transform(normalizeNip)
  .refine(isValidNip, "Ten NIP jest niepoprawny — sprawdź cyfry.");

export const nipLookupSchema = z.object({
  nip: nipSchema,
});

export const businessProfileSchema = z.object({
  nip: nipSchema,
  companyName: z.string().trim().min(2, "Podaj nazwę firmy.").max(200),
  address: z.string().trim().max(300).optional(),
});

export type BusinessProfileInput = z.infer<typeof businessProfileSchema>;
