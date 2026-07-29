import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import type { Point } from "@/db/geo";
import { businessProfiles, parkingPhotos, parkings, users } from "@/db/schema";
import { tstz } from "@/db/time";
import { checkHostCanPublish } from "@/modules/payments/onboarding";
import { AdminError, notFound } from "./errors";
import { PARKING_STATUS_LABEL } from "./labels";
import { decodeCursor, toPage, type Page } from "./pagination";
import { notifyParkingReviewed } from "./ports";
import { moderationQueueSchema, reviewParkingSchema } from "./schemas";

export type ModerationItem = {
  id: string;
  createdAt: Date;
  title: string | null;
  status: (typeof parkings.$inferSelect)["status"];
  ownerType: (typeof parkings.$inferSelect)["ownerType"];
  address: string | null;
  capacity: number | null;
  profileCompleteness: number;
  photoCount: number;
  maxVehicleHeightCm: number | null;
  pricePerHourGr: number | null;
  pricePerDayGr: number | null;
  pricePerEventGr: number | null;
  rejectionReason: string | null;
  ownerId: string;
  ownerEmail: string;
  ownerName: string | null;
  companyName: string | null;
};

const photoCountSql = sql<number>`(
  SELECT count(*)::int FROM ${parkingPhotos} WHERE ${parkingPhotos.parkingId} = ${parkings.id}
)`;

const ownerNameSql = sql<
  string | null
>`nullif(trim(concat_ws(' ', ${users.firstName}, ${users.lastName})), '')`;

/** Oldest first: a moderation queue that is not FIFO is a queue somebody starves in. */
export async function listModerationQueue(input: unknown): Promise<Page<ModerationItem>> {
  const { status, limit, cursor: rawCursor } = moderationQueueSchema.parse(input);
  const cursor = decodeCursor(rawCursor);

  const rows = await db
    .select({
      id: parkings.id,
      createdAt: parkings.createdAt,
      title: parkings.title,
      status: parkings.status,
      ownerType: parkings.ownerType,
      address: parkings.address,
      capacity: parkings.capacity,
      profileCompleteness: parkings.profileCompleteness,
      photoCount: photoCountSql,
      maxVehicleHeightCm: parkings.maxVehicleHeightCm,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      rejectionReason: parkings.rejectionReason,
      ownerId: users.id,
      ownerEmail: users.email,
      ownerName: ownerNameSql,
      companyName: businessProfiles.companyName,
    })
    .from(parkings)
    .innerJoin(users, eq(users.id, parkings.ownerId))
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(
      and(
        eq(parkings.status, status),
        cursor
          ? sql`(${parkings.createdAt}, ${parkings.id}) > (${tstz(cursor.createdAt)}, ${cursor.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(asc(parkings.createdAt), asc(parkings.id))
    .limit(limit + 1);

  return toPage(rows, limit);
}

export type ParkingReviewDetail = ModerationItem & {
  description: string | null;
  location: Point | null;
  entranceLocation: Point | null;
  entranceNotes: string | null;
  parkingType: (typeof parkings.$inferSelect)["parkingType"];
  accessType: (typeof parkings.$inferSelect)["accessType"];
  availabilityMode: (typeof parkings.$inferSelect)["availabilityMode"];
  isCovered: boolean | null;
  isGuarded: boolean | null;
  isLit: boolean | null;
  payoutBankAccount: string | null;
  photos: { id: string; objectKey: string; sortOrder: number }[];
};

export async function getParkingForReview(parkingId: string): Promise<ParkingReviewDetail> {
  const [row] = await db
    .select({
      id: parkings.id,
      createdAt: parkings.createdAt,
      title: parkings.title,
      status: parkings.status,
      ownerType: parkings.ownerType,
      address: parkings.address,
      capacity: parkings.capacity,
      profileCompleteness: parkings.profileCompleteness,
      photoCount: photoCountSql,
      maxVehicleHeightCm: parkings.maxVehicleHeightCm,
      pricePerHourGr: parkings.pricePerHourGr,
      pricePerDayGr: parkings.pricePerDayGr,
      pricePerEventGr: parkings.pricePerEventGr,
      rejectionReason: parkings.rejectionReason,
      ownerId: users.id,
      ownerEmail: users.email,
      ownerName: ownerNameSql,
      companyName: businessProfiles.companyName,
      description: parkings.description,
      location: parkings.location,
      entranceLocation: parkings.entranceLocation,
      entranceNotes: parkings.entranceNotes,
      parkingType: parkings.parkingType,
      accessType: parkings.accessType,
      availabilityMode: parkings.availabilityMode,
      isCovered: parkings.isCovered,
      isGuarded: parkings.isGuarded,
      isLit: parkings.isLit,
      payoutBankAccount: parkings.payoutBankAccount,
    })
    .from(parkings)
    .innerJoin(users, eq(users.id, parkings.ownerId))
    .leftJoin(businessProfiles, eq(businessProfiles.userId, users.id))
    .where(eq(parkings.id, parkingId))
    .limit(1);

  if (!row) throw notFound("Parking");

  const photos = await db
    .select({
      id: parkingPhotos.id,
      objectKey: parkingPhotos.objectKey,
      sortOrder: parkingPhotos.sortOrder,
    })
    .from(parkingPhotos)
    .where(eq(parkingPhotos.parkingId, parkingId))
    .orderBy(asc(parkingPhotos.sortOrder));

  return { ...row, photos };
}

export type ReviewResult = {
  parkingId: string;
  decision: "ACTIVE" | "REJECTED";
  /** False when the host was not told — the operator has to know that. */
  mailSent: boolean;
};

export async function reviewParking(input: unknown): Promise<ReviewResult> {
  const { parkingId, decision, reason } = reviewParkingSchema.parse(input);

  if (decision === "REJECTED" && !reason) {
    throw new AdminError(
      "REASON_REQUIRED",
      422,
      "Odrzucenie wymaga powodu. Host dostanie go w mailu i musi wiedzieć, co poprawić.",
    );
  }

  const parking = await db.transaction(async (tx) => {
    const [current] = await tx
      .select({
        id: parkings.id,
        status: parkings.status,
        title: parkings.title,
        ownerId: parkings.ownerId,
      })
      .from(parkings)
      .where(eq(parkings.id, parkingId))
      .for("update")
      .limit(1);

    if (!current) throw notFound("Parking");

    /**
     * REJECTED is reviewable again, PENDING_REVIEW obviously is. A rejection is
     * a decision a human made in a hurry — sometimes wrongly, sometimes before
     * the host fixed the thing over the phone — and until this was allowed there
     * was no way back from it: the admin panel offered no action on a rejected
     * parking, so the only listing on production sat unpublishable and the map
     * stayed empty. Approving one that was rejected clears the reason with it.
     */
    if (current.status !== "PENDING_REVIEW" && current.status !== "REJECTED") {
      throw new AdminError(
        "INVALID_STATE",
        422,
        `Ten parking nie czeka już na moderację (status: ${PARKING_STATUS_LABEL[current.status].toLowerCase()}). Ktoś rozpatrzył go wcześniej — odśwież listę.`,
      );
    }

    // Approval is the moment the spot actually goes on sale, so the payouts gate
    // is checked here and not only at submit: a parking can wait a day in this
    // queue, and Stripe can pull a host's payouts in that day. No-op under the
    // mock provider (docs/PAYMENTS.md §2.2).
    if (decision === "ACTIVE") {
      const blocked = await checkHostCanPublish(current.ownerId);
      if (blocked) {
        throw new AdminError(
          blocked.reason,
          422,
          "Host nie ma ukończonej weryfikacji wypłat w Stripe. Zatwierdzenie tego parkingu oznaczałoby sprzedaż miejsca, za które nie umiemy zapłacić hostowi.",
        );
      }
    }

    await tx
      .update(parkings)
      .set({
        status: decision,
        rejectionReason: decision === "REJECTED" ? (reason ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(parkings.id, parkingId));

    return current;
  });

  const mailSent = await notifyParkingReviewed({
    hostId: parking.ownerId,
    parkingId,
    parkingTitle: parking.title ?? "Parking bez nazwy",
    decision,
    ...(decision === "REJECTED" && reason ? { reason } : {}),
  });

  return { parkingId, decision, mailSent };
}

export async function countPendingReview(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(parkings)
    .where(eq(parkings.status, "PENDING_REVIEW"));
  return row?.count ?? 0;
}
