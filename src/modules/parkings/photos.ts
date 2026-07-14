import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { parkingPhotos } from "@/db/schema";
import type { SelectParkingPhoto } from "@/db/types";
import {
  buildObjectKey,
  createUploadUrl,
  deleteObject,
  headObject,
  MAX_PHOTO_BYTES,
  PHOTO_CONTENT_TYPES,
  publicUrl,
  UPLOAD_URL_TTL_SECONDS,
  type PhotoContentType,
} from "@/lib/s3";
import { ApiError } from "./errors";

export const MAX_PHOTOS_PER_PARKING = 10;

export type PhotoView = {
  id: string;
  objectKey: string;
  url: string;
  sortOrder: number;
  width: number | null;
  height: number | null;
};

function toView(photo: SelectParkingPhoto): PhotoView {
  return {
    id: photo.id,
    objectKey: photo.objectKey,
    url: publicUrl(photo.objectKey),
    sortOrder: photo.sortOrder,
    width: photo.width,
    height: photo.height,
  };
}

export async function listPhotos(parkingId: string): Promise<PhotoView[]> {
  const rows = await db
    .select()
    .from(parkingPhotos)
    .where(eq(parkingPhotos.parkingId, parkingId))
    .orderBy(asc(parkingPhotos.sortOrder), asc(parkingPhotos.createdAt));

  return rows.map(toView);
}

export async function countPhotos(parkingId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(parkingPhotos)
    .where(eq(parkingPhotos.parkingId, parkingId));

  return row?.value ?? 0;
}

export type UploadTicket = {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  maxBytes: number;
};

export async function createPhotoUpload(
  parkingId: string,
  contentType: PhotoContentType,
): Promise<UploadTicket> {
  const existing = await countPhotos(parkingId);
  if (existing >= MAX_PHOTOS_PER_PARKING) {
    throw new ApiError(
      "CONFLICT",
      `Ten parking ma już ${MAX_PHOTOS_PER_PARKING} zdjęć. Usuń jedno, żeby dodać nowe.`,
    );
  }

  const objectKey = buildObjectKey(parkingId, contentType);
  const uploadUrl = await createUploadUrl(objectKey, contentType);

  return {
    uploadUrl,
    objectKey,
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    maxBytes: MAX_PHOTO_BYTES,
  };
}

/**
 * Called after the browser has PUT the file straight to storage. A presigned PUT
 * cannot enforce a size or a type, so this is where both are checked — against the
 * object that actually landed, not against what the client claims it uploaded. A
 * rejected object is deleted immediately; it is never linked to the parking.
 */
export async function confirmPhoto(
  parkingId: string,
  input: { objectKey: string; width?: number; height?: number },
): Promise<PhotoView> {
  if (!input.objectKey.startsWith(`parkings/${parkingId}/`)) {
    throw new ApiError("FORBIDDEN", "Ten plik nie należy do tego parkingu.");
  }

  const existing = await countPhotos(parkingId);
  if (existing >= MAX_PHOTOS_PER_PARKING) {
    await deleteObject(input.objectKey);
    throw new ApiError(
      "CONFLICT",
      `Ten parking ma już ${MAX_PHOTOS_PER_PARKING} zdjęć. Usuń jedno, żeby dodać nowe.`,
    );
  }

  const head = await headObject(input.objectKey);
  if (!head) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy wgranego pliku. Spróbuj jeszcze raz.");
  }

  const isImage = PHOTO_CONTENT_TYPES.includes(head.contentType as PhotoContentType);
  if (!isImage) {
    await deleteObject(input.objectKey);
    throw new ApiError("VALIDATION", "Wgraj zdjęcie w formacie JPG, PNG, WebP albo AVIF.");
  }

  if (head.contentLength > MAX_PHOTO_BYTES) {
    await deleteObject(input.objectKey);
    throw new ApiError(
      "VALIDATION",
      `Zdjęcie waży ponad ${Math.round(MAX_PHOTO_BYTES / (1024 * 1024))} MB. Zmniejsz je i wgraj ponownie.`,
    );
  }

  const [photo] = await db
    .insert(parkingPhotos)
    .values({
      parkingId,
      objectKey: input.objectKey,
      sortOrder: existing,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .returning();

  if (!photo) {
    throw new ApiError("CONFLICT", "Nie udało się zapisać zdjęcia. Spróbuj jeszcze raz.");
  }

  return toView(photo);
}

export async function deletePhoto(parkingId: string, photoId: string): Promise<void> {
  const [photo] = await db
    .delete(parkingPhotos)
    .where(and(eq(parkingPhotos.id, photoId), eq(parkingPhotos.parkingId, parkingId)))
    .returning();

  if (!photo) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego zdjęcia.");
  }

  // The row is gone either way — a stray object in storage is cheaper than a
  // parking card pointing at a photo that no longer exists.
  await deleteObject(photo.objectKey).catch(() => undefined);
}
