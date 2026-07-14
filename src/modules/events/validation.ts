import { z } from "zod";

export const eventIdSchema = z.uuid();

export const listEventsQuerySchema = z.object({
  upcoming: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;

/** Prices are integer grosze, always. 500 gr – 500 zł is the sane band for one event slot. */
export const eventPriceGrSchema = z.number().int().min(500).max(50_000);

export const declareAvailabilitySchema = z
  .object({
    parkingId: z.uuid(),
    isAvailable: z.boolean(),
    spots: z.number().int().min(1).max(10_000).nullish(),
    priceGr: eventPriceGrSchema.nullish(),
    notes: z.string().trim().max(280).nullish(),
  })
  .transform((value) => ({
    ...value,
    spots: value.spots ?? null,
    priceGr: value.priceGr ?? null,
    notes: value.notes && value.notes.length > 0 ? value.notes : null,
  }));

export type DeclareAvailabilityInput = z.infer<typeof declareAvailabilitySchema>;

/**
 * Critical path 3 (docs/DESIGN_PRINCIPLES.md §7): one click from an e-mail, no
 * login. `accept` is the whole decision — spots and price come from the token's
 * payload, so the page can stay at one question and two buttons.
 */
export const quickDeclareSchema = z.object({
  token: z.string().min(20).max(200),
  accept: z.boolean(),
});

export type QuickDeclareInput = z.infer<typeof quickDeclareSchema>;
