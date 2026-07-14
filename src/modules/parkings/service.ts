import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import type { Point } from "@/db/geo";
import { parkingPhotos, parkings, userRoles } from "@/db/schema";
import type { OwnerType, ParkingStatus, SelectParking } from "@/db/types";
import { estimateWalk } from "@/lib/format";
import { checkHostCanPublish } from "@/modules/payments/onboarding";
import { evaluateCompleteness, type CompletenessResult } from "./completeness";
import { ApiError, type ErrorDetail } from "./errors";
import { listPhotos, type PhotoView } from "./photos";
import type { ParkingPatchInput } from "./schemas";
import type { Session } from "./session";

/* -------------------------------------------------------------------------- */
/* Ownership                                                                  */
/* -------------------------------------------------------------------------- */

async function loadOwned(session: Session, parkingId: string): Promise<SelectParking> {
  const [parking] = await db
    .select()
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    .limit(1);

  if (!parking) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }
  if (parking.ownerId !== session.userId) {
    // Same message as a missing row: an attacker must not learn that an id exists.
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }
  return parking;
}

/** Throws 404 (never 403) if the parking is not this host's — see loadOwned(). */
export async function assertOwnership(session: Session, parkingId: string): Promise<SelectParking> {
  return loadOwned(session, parkingId);
}

async function resolveOwnerType(
  session: Session,
  requested: OwnerType | undefined,
): Promise<OwnerType> {
  const isBusiness = session.roles.includes("HOST_BUSINESS");

  if (requested === "BUSINESS" && !isBusiness) {
    const [row] = await db
      .select({ value: count() })
      .from(userRoles)
      .where(and(eq(userRoles.userId, session.userId), eq(userRoles.role, "HOST_BUSINESS")));

    if ((row?.value ?? 0) === 0) {
      throw new ApiError(
        "UNPROCESSABLE",
        "Aby wystawić parking jako firma, dodaj najpierw dane firmy (NIP) w ustawieniach konta.",
      );
    }
    return "BUSINESS";
  }

  return requested ?? (isBusiness ? "BUSINESS" : "INDIVIDUAL");
}

/* -------------------------------------------------------------------------- */
/* Write                                                                      */
/* -------------------------------------------------------------------------- */

type ParkingColumns = typeof parkings.$inferInsert;

function toColumns(input: ParkingPatchInput): Partial<ParkingColumns> {
  const columns: Partial<ParkingColumns> = {};

  // Only keys the client actually sent are copied: autosave PATCHes one step at a
  // time, so an absent key means "unchanged" while an explicit null means "clear".
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (key === "ownerType") continue;
    Reflect.set(columns, key, value);
  }

  return columns;
}

async function recomputeCompleteness(parkingId: string): Promise<number> {
  const [parking] = await db
    .select()
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    .limit(1);

  if (!parking) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }

  const [photos] = await db
    .select({ value: count() })
    .from(parkingPhotos)
    .where(eq(parkingPhotos.parkingId, parkingId));

  const { score } = evaluateCompleteness({ ...parking, photoCount: photos?.value ?? 0 });

  await db
    .update(parkings)
    .set({ profileCompleteness: score, updatedAt: new Date() })
    .where(eq(parkings.id, parkingId));

  return score;
}

export type DraftResult = {
  id: string;
  status: ParkingStatus;
  profileCompleteness: number;
  updatedAt: Date;
};

export async function createDraft(
  session: Session,
  // The patch shape, not the write shape: the form's first autosave carries explicit
  // nulls for the fields the host has not reached yet. See app/api/parkings/route.ts.
  input: ParkingPatchInput,
): Promise<DraftResult> {
  const ownerType = await resolveOwnerType(session, input.ownerType);

  const [created] = await db
    .insert(parkings)
    .values({
      ...toColumns(input),
      ownerId: session.userId,
      ownerType,
      status: "DRAFT",
    })
    .returning({ id: parkings.id, status: parkings.status, updatedAt: parkings.updatedAt });

  if (!created) {
    throw new ApiError("CONFLICT", "Nie udało się utworzyć parkingu. Spróbuj jeszcze raz.");
  }

  const profileCompleteness = await recomputeCompleteness(created.id);

  return { ...created, profileCompleteness };
}

/**
 * Autosave. Called after every step of the form and on tab close, so it must be
 * cheap, partial and never destructive: closing the tab cannot lose what was typed
 * (docs/DESIGN_PRINCIPLES.md §6.3).
 */
export async function patchParking(
  session: Session,
  parkingId: string,
  input: ParkingPatchInput,
): Promise<DraftResult> {
  const parking = await loadOwned(session, parkingId);

  const columns = toColumns(input);

  if (input.ownerType && input.ownerType !== parking.ownerType) {
    columns.ownerType = await resolveOwnerType(session, input.ownerType);
  }

  if (Object.keys(columns).length > 0) {
    await db
      .update(parkings)
      .set({ ...columns, updatedAt: new Date() })
      .where(eq(parkings.id, parkingId));
  }

  const profileCompleteness = await recomputeCompleteness(parkingId);

  const [updated] = await db
    .select({ status: parkings.status, updatedAt: parkings.updatedAt })
    .from(parkings)
    .where(eq(parkings.id, parkingId))
    .limit(1);

  return {
    id: parkingId,
    status: updated?.status ?? parking.status,
    profileCompleteness,
    updatedAt: updated?.updatedAt ?? new Date(),
  };
}

/* -------------------------------------------------------------------------- */
/* Submit for review                                                          */
/* -------------------------------------------------------------------------- */

/** The five fields without which a parking cannot be sold (docs/DATA_MODEL.md §3). */
export function missingForPublication(parking: SelectParking): ErrorDetail[] {
  const missing: ErrorDetail[] = [];

  if (!parking.title) {
    missing.push({ field: "title", message: "Podaj nazwę parkingu." });
  }
  if (!parking.location) {
    missing.push({ field: "location", message: "Wskaż parking na mapie." });
  }
  if (!parking.capacity) {
    missing.push({ field: "capacity", message: "Podaj liczbę miejsc." });
  }
  if (
    parking.pricePerHourGr === null &&
    parking.pricePerDayGr === null &&
    parking.pricePerEventGr === null
  ) {
    missing.push({
      field: "price",
      message: "Ustaw przynajmniej jedną cenę: za godzinę, za dobę albo za wydarzenie.",
    });
  }
  if (!parking.ownerType) {
    missing.push({ field: "ownerType", message: "Wskaż, czy wystawiasz parking prywatnie, czy jako firma." });
  }

  // Not one of the five, but a schedule-driven parking with an empty schedule is a
  // listing nobody can ever buy — it would sit in the map as a dead pin.
  if (
    parking.availabilityMode === "RECURRING_SCHEDULE" &&
    Object.values(parking.schedule ?? {}).every((slots) => (slots?.length ?? 0) === 0)
  ) {
    missing.push({
      field: "schedule",
      message: "Zaznacz godziny, w których parking jest dostępny.",
    });
  }

  return missing;
}

export async function submitForReview(
  session: Session,
  parkingId: string,
): Promise<{ id: string; status: ParkingStatus }> {
  const parking = await loadOwned(session, parkingId);

  if (!["DRAFT", "REJECTED", "PENDING_REVIEW"].includes(parking.status)) {
    throw new ApiError(
      "UNPROCESSABLE",
      "Ten parking jest już opublikowany. Zmiany zapisują się od razu.",
    );
  }

  const missing = missingForPublication(parking);
  if (missing.length > 0) {
    throw new ApiError("UNPROCESSABLE", "Zanim wyślemy parking do sprawdzenia, uzupełnij:", missing);
  }

  // The payouts gate (docs/PAYMENTS.md §2.2). Told to the host here, at submit,
  // rather than only at approval — finding out that your listing is unsellable
  // should not require waiting a day for a moderator to tell you. No-op under the
  // mock provider, or dev would be unable to publish anything.
  const blocked = await checkHostCanPublish(session.userId);
  if (blocked) {
    throw new ApiError("UNPROCESSABLE", blocked.message, [
      { field: "payouts", message: "Dokończ weryfikację w Stripe w zakładce Wypłaty." },
    ]);
  }

  await db
    .update(parkings)
    .set({ status: "PENDING_REVIEW", rejectionReason: null, updatedAt: new Date() })
    .where(eq(parkings.id, parkingId));

  return { id: parkingId, status: "PENDING_REVIEW" };
}

export async function pauseParking(
  session: Session,
  parkingId: string,
): Promise<{ id: string; status: ParkingStatus }> {
  const parking = await loadOwned(session, parkingId);

  if (parking.status !== "ACTIVE") {
    throw new ApiError("UNPROCESSABLE", "Wstrzymać można tylko parking, który jest w sprzedaży.");
  }

  await db
    .update(parkings)
    .set({ status: "PAUSED", updatedAt: new Date() })
    .where(eq(parkings.id, parkingId));

  return { id: parkingId, status: "PAUSED" };
}

export async function resumeParking(
  session: Session,
  parkingId: string,
): Promise<{ id: string; status: ParkingStatus }> {
  const parking = await loadOwned(session, parkingId);

  if (parking.status !== "PAUSED") {
    throw new ApiError("UNPROCESSABLE", "Wznowić można tylko wstrzymany parking.");
  }

  // Resuming is the third door into ACTIVE, and a host can have been verified
  // when they paused and not be verified when they resume.
  const blocked = await checkHostCanPublish(session.userId);
  if (blocked) {
    throw new ApiError("UNPROCESSABLE", blocked.message, [
      { field: "payouts", message: "Dokończ weryfikację w Stripe w zakładce Wypłaty." },
    ]);
  }

  await db
    .update(parkings)
    .set({ status: "ACTIVE", updatedAt: new Date() })
    .where(eq(parkings.id, parkingId));

  return { id: parkingId, status: "ACTIVE" };
}

/* -------------------------------------------------------------------------- */
/* Read — host                                                                */
/* -------------------------------------------------------------------------- */

export type HostParkingRow = {
  id: string;
  title: string | null;
  address: string | null;
  status: ParkingStatus;
  rejectionReason: string | null;
  capacity: number | null;
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  profileCompleteness: number;
  photoCount: number;
  updatedAt: Date;
};

export async function listMyParkings(session: Session): Promise<HostParkingRow[]> {
  const photoCount = sql<number>`(
    SELECT COUNT(*)::int FROM parking_photos p WHERE p.parking_id = ${parkings.id}
  )`;

  return db
    .select({
      id: parkings.id,
      title: parkings.title,
      address: parkings.address,
      status: parkings.status,
      rejectionReason: parkings.rejectionReason,
      capacity: parkings.capacity,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      profileCompleteness: parkings.profileCompleteness,
      photoCount,
      updatedAt: parkings.updatedAt,
    })
    .from(parkings)
    .where(eq(parkings.ownerId, session.userId))
    .orderBy(desc(parkings.updatedAt));
}

export type OwnerParkingView = SelectParking & {
  photos: PhotoView[];
  completeness: CompletenessResult;
  missingForPublication: ErrorDetail[];
};

export async function getParkingForOwner(
  session: Session,
  parkingId: string,
): Promise<OwnerParkingView> {
  const parking = await loadOwned(session, parkingId);
  const photos = await listPhotos(parkingId);

  return {
    ...parking,
    photos,
    completeness: evaluateCompleteness({ ...parking, photoCount: photos.length }),
    missingForPublication: missingForPublication(parking),
  };
}

/* -------------------------------------------------------------------------- */
/* Read — public                                                              */
/* -------------------------------------------------------------------------- */

export type PublicParking = {
  id: string;
  title: string | null;
  description: string | null;
  address: string | null;
  location: Point | null;
  entranceLocation: Point | null;
  entranceNotes: string | null;
  ownerType: OwnerType;
  capacity: number | null;
  parkingType: SelectParking["parkingType"];
  accessType: SelectParking["accessType"];
  surface: SelectParking["surface"];
  isCovered: boolean | null;
  isGuarded: boolean | null;
  hasCctv: boolean | null;
  isLit: boolean | null;
  isFenced: boolean | null;
  maxVehicleHeightCm: number | null;
  maxVehicleLengthCm: number | null;
  vehicleTypes: SelectParking["vehicleTypes"];
  hasEvCharging: boolean | null;
  evConnectorTypes: SelectParking["evConnectorTypes"];
  hasDisabledAccess: boolean | null;
  disabledSpotsCount: number | null;
  availabilityMode: SelectParking["availabilityMode"];
  schedule: SelectParking["schedule"];
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  minBookingMinutes: number;
  freeMinutes: number;
  profileCompleteness: number;
  photos: PhotoView[];
  /** PAUSED parkings stay readable (a driver may hold a booking) but cannot be sold. */
  isBookable: boolean;

  /**
   * The card contract (docs/API_SPEC.md §3), and the reason it exists: the client
   * reads `priceGr` / `priceUnit` / `distanceMeters`, and the endpoint used to
   * answer with the raw `price_per_*_gr` columns and a `straightLineMeters`
   * instead. Zod then rejected the payload, the bottom sheet fell into its error
   * branch ("Nie udało się wczytać tego parkingu"), and "Zarezerwuj" — the single
   * most important button in the product — could not be reached from the map at all.
   */

  /** The "from" price, by the same COALESCE the pin uses, so the sheet cannot
   *  contradict the number the driver just tapped. */
  priceGr: number | null;
  /** What that price buys, in the driver's words: "za godzinę", "za mecz", "za dobę". */
  priceUnit: string | null;
  /** Straight line × 1.3. Detoured here, so the client never applies the factor twice. */
  distanceMeters: number | null;
  isApproximate: true;
};

/** Cheapest way in first — identical to the pin's rule in queries.ts. */
function fromPrice(parking: {
  pricePerHourGr: number | null;
  pricePerEventGr: number | null;
  pricePerDayGr: number | null;
}): { priceGr: number | null; priceUnit: string | null } {
  if (parking.pricePerHourGr !== null) {
    return { priceGr: parking.pricePerHourGr, priceUnit: "za godzinę" };
  }
  if (parking.pricePerEventGr !== null) {
    return { priceGr: parking.pricePerEventGr, priceUnit: "za wydarzenie" };
  }
  if (parking.pricePerDayGr !== null) {
    return { priceGr: parking.pricePerDayGr, priceUnit: "za dobę" };
  }
  return { priceGr: null, priceUnit: null };
}

// json_build_object on a NULL geography would return {"lat":null,"lng":null} — an
// object that looks like a coordinate and is not one.
const pointJson = (column: AnyPgColumn) =>
  sql<Point | null>`CASE
    WHEN ${column} IS NULL THEN NULL
    ELSE json_build_object('lng', ST_X(${column}::geometry), 'lat', ST_Y(${column}::geometry))
  END`;

/**
 * The public card. access_instructions and payout_bank_account are not omitted by
 * deleting them from a row — they are never selected. A driver sees the entry code
 * only after paying (docs/API_SPEC.md §3), and the host's IBAN never leaves the
 * database at all.
 */
export async function getPublicParking(
  parkingId: string,
  from?: Point,
): Promise<PublicParking> {
  const distance = from
    ? sql<number>`ST_Distance(${parkings.location}, ST_SetSRID(ST_MakePoint(${from.lng}, ${from.lat}), 4326)::geography)`
    : sql<number | null>`NULL::float8`;

  const [row] = await db
    .select({
      id: parkings.id,
      title: parkings.title,
      description: parkings.description,
      address: parkings.address,
      location: pointJson(parkings.location),
      entranceLocation: pointJson(parkings.entranceLocation),
      entranceNotes: parkings.entranceNotes,
      ownerType: parkings.ownerType,
      status: parkings.status,
      capacity: parkings.capacity,
      parkingType: parkings.parkingType,
      accessType: parkings.accessType,
      surface: parkings.surface,
      isCovered: parkings.isCovered,
      isGuarded: parkings.isGuarded,
      hasCctv: parkings.hasCctv,
      isLit: parkings.isLit,
      isFenced: parkings.isFenced,
      maxVehicleHeightCm: parkings.maxVehicleHeightCm,
      maxVehicleLengthCm: parkings.maxVehicleLengthCm,
      vehicleTypes: parkings.vehicleTypes,
      hasEvCharging: parkings.hasEvCharging,
      evConnectorTypes: parkings.evConnectorTypes,
      hasDisabledAccess: parkings.hasDisabledAccess,
      disabledSpotsCount: parkings.disabledSpotsCount,
      availabilityMode: parkings.availabilityMode,
      schedule: parkings.schedule,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      minBookingMinutes: parkings.minBookingMinutes,
      freeMinutes: parkings.freeMinutes,
      profileCompleteness: parkings.profileCompleteness,
      straightLineMeters: distance,
    })
    .from(parkings)
    .where(and(eq(parkings.id, parkingId), inArray(parkings.status, ["ACTIVE", "PAUSED"])))
    .limit(1);

  if (!row) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }

  const { status, straightLineMeters, ...rest } = row;
  const photos = await listPhotos(parkingId);

  return {
    ...rest,
    ...fromPrice(rest),
    photos,
    isBookable: status === "ACTIVE",
    // Detoured once, here. `isApproximate` stays true because it is: this is a
    // straight line with a fudge factor, not a walked route, and the copy has to
    // keep saying "ok." (CLAUDE.md — "Dystans pieszo ≠ dystans w linii prostej").
    distanceMeters:
      straightLineMeters === null
        ? null
        : estimateWalk(Math.round(Number(straightLineMeters))).meters,
    isApproximate: true,
  };
}
