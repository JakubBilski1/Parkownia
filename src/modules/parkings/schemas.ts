import { z } from "zod";
import {
  accessTypeEnum,
  availabilityModeEnum,
  evConnectorTypeEnum,
  ownerTypeEnum,
  parkingTypeEnum,
  surfaceEnum,
  vehicleTypeEnum,
} from "@/db/schema";
import { PHOTO_CONTENT_TYPES } from "@/lib/s3";

/* -------------------------------------------------------------------------- */
/* Primitives                                                                 */
/* -------------------------------------------------------------------------- */

export const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// "24:00" is not a clock time but it is how a host writes "do północy", and the
// schedule resolver in availability.ts understands it as the next midnight.
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

const scheduleSlotSchema = z.object({
  from: z.string().regex(TIME_PATTERN, "Godzina w formacie 08:00."),
  to: z.string().regex(TIME_PATTERN, "Godzina w formacie 22:00."),
});

const daySchema = z.array(scheduleSlotSchema).max(4);

export const scheduleSchema = z.object({
  mon: daySchema.optional(),
  tue: daySchema.optional(),
  wed: daySchema.optional(),
  thu: daySchema.optional(),
  fri: daySchema.optional(),
  sat: daySchema.optional(),
  sun: daySchema.optional(),
});

const priceGrSchema = z.int().min(0).max(1_000_000);

/* -------------------------------------------------------------------------- */
/* Parking write model                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Everything is optional: the form autosaves to DRAFT after every step, so a
 * half-filled parking is a legal payload. The five publication requirements are
 * enforced once, at submit (service.ts), never while the host is still typing.
 */
export const parkingWriteSchema = z.object({
  ownerType: z.enum(ownerTypeEnum.enumValues).optional(),
  title: z.string().trim().min(3).max(120).optional(),
  description: z.string().trim().max(4000).optional(),
  location: pointSchema.optional(),
  address: z.string().trim().max(240).optional(),
  capacity: z.int().min(1).max(5000).optional(),
  parkingType: z.enum(parkingTypeEnum.enumValues).optional(),
  accessType: z.enum(accessTypeEnum.enumValues).optional(),
  accessInstructions: z.string().trim().max(2000).optional(),
  entranceLocation: pointSchema.optional(),
  entranceNotes: z.string().trim().max(500).optional(),
  surface: z.enum(surfaceEnum.enumValues).optional(),
  isCovered: z.boolean().optional(),
  isGuarded: z.boolean().optional(),
  hasCctv: z.boolean().optional(),
  isLit: z.boolean().optional(),
  isFenced: z.boolean().optional(),
  maxVehicleHeightCm: z.int().min(100).max(600).optional(),
  maxVehicleLengthCm: z.int().min(200).max(2500).optional(),
  vehicleTypes: z.array(z.enum(vehicleTypeEnum.enumValues)).max(7).optional(),
  hasEvCharging: z.boolean().optional(),
  evConnectorTypes: z.array(z.enum(evConnectorTypeEnum.enumValues)).max(4).optional(),
  hasDisabledAccess: z.boolean().optional(),
  disabledSpotsCount: z.int().min(0).max(500).optional(),
  availabilityMode: z.enum(availabilityModeEnum.enumValues).optional(),
  schedule: scheduleSchema.optional(),
  pricePerHourGr: priceGrSchema.optional(),
  pricePerDayGr: priceGrSchema.optional(),
  pricePerEventGr: priceGrSchema.optional(),
  minBookingMinutes: z.int().min(15).max(1440).optional(),
  freeMinutes: z.int().min(0).max(240).optional(),
  payoutBankAccount: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, "").toUpperCase())
    .pipe(z.string().regex(/^PL\d{26}$/, "IBAN w formacie PL i 26 cyfr."))
    .optional(),
});

// A field explicitly sent as null means "clear it"; a field left out means
// "leave it alone". Autosave sends partial payloads, so the two must differ.
export const parkingPatchSchema = parkingWriteSchema.extend({
  description: parkingWriteSchema.shape.description.nullable(),
  address: parkingWriteSchema.shape.address.nullable(),
  parkingType: parkingWriteSchema.shape.parkingType.nullable(),
  accessType: parkingWriteSchema.shape.accessType.nullable(),
  accessInstructions: parkingWriteSchema.shape.accessInstructions.nullable(),
  entranceLocation: parkingWriteSchema.shape.entranceLocation.nullable(),
  entranceNotes: parkingWriteSchema.shape.entranceNotes.nullable(),
  surface: parkingWriteSchema.shape.surface.nullable(),
  isCovered: parkingWriteSchema.shape.isCovered.nullable(),
  isGuarded: parkingWriteSchema.shape.isGuarded.nullable(),
  hasCctv: parkingWriteSchema.shape.hasCctv.nullable(),
  isLit: parkingWriteSchema.shape.isLit.nullable(),
  isFenced: parkingWriteSchema.shape.isFenced.nullable(),
  maxVehicleHeightCm: parkingWriteSchema.shape.maxVehicleHeightCm.nullable(),
  maxVehicleLengthCm: parkingWriteSchema.shape.maxVehicleLengthCm.nullable(),
  hasEvCharging: parkingWriteSchema.shape.hasEvCharging.nullable(),
  hasDisabledAccess: parkingWriteSchema.shape.hasDisabledAccess.nullable(),
  disabledSpotsCount: parkingWriteSchema.shape.disabledSpotsCount.nullable(),
  schedule: parkingWriteSchema.shape.schedule.nullable(),
  pricePerHourGr: parkingWriteSchema.shape.pricePerHourGr.nullable(),
  pricePerDayGr: parkingWriteSchema.shape.pricePerDayGr.nullable(),
  pricePerEventGr: parkingWriteSchema.shape.pricePerEventGr.nullable(),
  payoutBankAccount: parkingWriteSchema.shape.payoutBankAccount.nullable(),
});

export type ParkingWriteInput = z.infer<typeof parkingWriteSchema>;
export type ParkingPatchInput = z.infer<typeof parkingPatchSchema>;

/* -------------------------------------------------------------------------- */
/* Map and search                                                             */
/* -------------------------------------------------------------------------- */

const csv = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((value) => value.split(",").map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1).max(values.length));

const boolParam = z.enum(["true", "false"]).transform((value) => value === "true");

const isoDate = z.iso.datetime({ offset: true }).transform((value) => new Date(value));

export const bboxSchema = z
  .string()
  .transform((value) => value.split(",").map(Number))
  .pipe(z.array(z.number().finite()).length(4))
  .transform(([west, south, east, north]) => ({
    west: west as number,
    south: south as number,
    east: east as number,
    north: north as number,
  }))
  .refine((bbox) => bbox.west < bbox.east && bbox.south < bbox.north, {
    message: "bbox musi mieć postać west,south,east,north.",
  });

export const parkingFiltersSchema = z
  .object({
    maxPriceGr: z.coerce.number().int().min(0).max(1_000_000).optional(),
    parkingType: csv(parkingTypeEnum.enumValues).optional(),
    accessType: csv(accessTypeEnum.enumValues).optional(),
    isCovered: boolParam.optional(),
    isGuarded: boolParam.optional(),
    // The driver's vehicle, not the parking's clearance: a 210 cm SUV must never
    // be shown a 190 cm garage (docs/DESIGN_PRINCIPLES.md §6.4).
    minHeightCm: z.coerce.number().int().min(100).max(400).optional(),
    availableFrom: isoDate.optional(),
    availableTo: isoDate.optional(),
    spots: z.coerce.number().int().min(1).max(50).default(1),
  })
  .refine(
    (filters) =>
      (filters.availableFrom === undefined) === (filters.availableTo === undefined),
    { message: "Podaj oba końce okna dostępności albo żaden.", path: ["availableTo"] },
  )
  .refine(
    (filters) =>
      !filters.availableFrom ||
      !filters.availableTo ||
      filters.availableTo.getTime() > filters.availableFrom.getTime(),
    { message: "Koniec okna musi być późniejszy niż początek.", path: ["availableTo"] },
  );

export type ParkingFilters = z.infer<typeof parkingFiltersSchema>;

export const nearbySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().int().min(50).max(20_000).default(1500),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const geocodeQuerySchema = z
  .object({
    q: z.string().trim().min(3).max(200).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((input) => Boolean(input.q) || (input.lat !== undefined && input.lng !== undefined), {
    message: "Podaj q= albo lat= i lng=.",
  });

/* -------------------------------------------------------------------------- */
/* Photos                                                                     */
/* -------------------------------------------------------------------------- */

export const photoUploadSchema = z.object({
  contentType: z.enum(PHOTO_CONTENT_TYPES),
});

export const photoConfirmSchema = z.object({
  objectKey: z.string().min(8).max(300),
  width: z.int().min(1).max(20_000).optional(),
  height: z.int().min(1).max(20_000).optional(),
});

/* -------------------------------------------------------------------------- */
/* Pricing quote (server-side only — the client never sends an amount)        */
/* -------------------------------------------------------------------------- */

export const quoteSchema = z
  .object({
    eventId: z.uuid().optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    spots: z.coerce.number().int().min(1).max(50).default(1),
  })
  .refine(
    (input) => Boolean(input.eventId) || (input.startsAt !== undefined && input.endsAt !== undefined),
    { message: "Podaj eventId albo startsAt i endsAt." },
  );
