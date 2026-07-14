import { z } from "zod";

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
