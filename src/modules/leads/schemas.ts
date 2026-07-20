import { z } from "zod";

// Roughly Poland. The geocoder already biases to Poznań; these bounds only reject
// obviously-off coordinates (e.g. a swapped lat/lng).
const latPL = z.coerce.number().min(49).max(55);
const lngPL = z.coerce.number().min(14).max(24);

export const publicGeocodeQuerySchema = z.object({
  q: z.string().trim().min(3, "Wpisz co najmniej 3 znaki.").max(200),
});
export type PublicGeocodeQuery = z.infer<typeof publicGeocodeQuerySchema>;

export const reachQuerySchema = z.object({ lat: latPL, lng: lngPL });
export type ReachQuery = z.infer<typeof reachQuerySchema>;

export const leadObjectTypeSchema = z.enum(["LOT", "DRIVEWAY", "COMPANY_LOT", "GARAGE", "OTHER"]);
export const leadContactPreferenceSchema = z.enum(["PHONE", "EMAIL"]);
export const leadOwnerKindSchema = z.enum(["INDIVIDUAL", "BUSINESS"]);

export const leadInputSchema = z
  .object({
    objectName: z.string().trim().max(120).optional(),
    address: z.string().trim().min(3, "Podaj adres obiektu.").max(240),
    lat: latPL.optional(),
    lng: lngPL.optional(),
    objectType: leadObjectTypeSchema.optional(),
    spots: z.coerce.number().int().min(1).max(100),
    contactName: z.string().trim().min(2, "Podaj imię.").max(120),
    phone: z.string().trim().min(6).max(30).optional(),
    email: z.string().trim().email("Podaj poprawny adres e-mail.").max(160).optional(),
    contactPreference: leadContactPreferenceSchema,
    ownerKind: leadOwnerKindSchema.optional(),
    // RODO: privacy consent is a CONDITION of leaving a lead — it must be true.
    privacyConsent: z.literal(true),
    // PKE art. 398: a separate, opt-in consent per channel. No SMS on the landing.
    marketingEmailConsent: z.boolean().optional().default(false),
    marketingPhoneConsent: z.boolean().optional().default(false),
    // Honeypot — a real person leaves it empty. Validated loosely; the route
    // decides what to do with it so a bot gets no hint from the error shape.
    website: z.string().max(200).optional(),
    source: z.string().trim().max(80).optional(),
  })
  .refine((d) => Boolean(d.phone) || Boolean(d.email), {
    message: "Zostaw telefon albo e-mail, żebyśmy mogli się odezwać.",
    path: ["phone"],
  })
  .refine((d) => d.contactPreference !== "PHONE" || Boolean(d.phone), {
    message: "Wybrałeś kontakt telefoniczny — podaj numer.",
    path: ["phone"],
  })
  .refine((d) => d.contactPreference !== "EMAIL" || Boolean(d.email), {
    message: "Wybrałeś kontakt e-mailem — podaj adres.",
    path: ["email"],
  });

export type LeadInput = z.infer<typeof leadInputSchema>;
