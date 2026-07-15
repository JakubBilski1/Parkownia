import {
  DeleteObjectCommand,
  HeadObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const PHOTO_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type PhotoContentType = (typeof PHOTO_CONTENT_TYPES)[number];

export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const UPLOAD_URL_TTL_SECONDS = 300;

const EXTENSION: Record<PhotoContentType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — copy .env.example to .env.local first.`);
  }
  return value;
}

declare global {
  var __parkspotS3: S3Client | undefined;
}

function client(): S3Client {
  if (globalThis.__parkspotS3) return globalThis.__parkspotS3;

  const config: S3ClientConfig = {
    endpoint: required("S3_ENDPOINT"),
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: required("S3_ACCESS_KEY"),
      secretAccessKey: required("S3_SECRET_KEY"),
    },
    // MinIO serves buckets as a path segment, not as a DNS subdomain.
    forcePathStyle: true,
  };

  const instance = new S3Client(config);
  if (process.env.NODE_ENV !== "production") {
    globalThis.__parkspotS3 = instance;
  }
  return instance;
}

function bucket(): string {
  return required("S3_BUCKET");
}

export function buildObjectKey(parkingId: string, contentType: PhotoContentType): string {
  return `parkings/${parkingId}/${crypto.randomUUID()}.${EXTENSION[contentType]}`;
}

export function publicUrl(objectKey: string): string {
  const base = process.env.S3_PUBLIC_URL ?? `${required("S3_ENDPOINT")}/${bucket()}`;
  return `${base.replace(/\/$/, "")}/${objectKey}`;
}

/**
 * The browser PUTs straight to storage, so the file never passes through the Node
 * process. A presigned PUT cannot cap the body size — that is enforced after the
 * fact by headObject() in the confirmation step, which rejects and deletes an
 * oversized object before it is ever linked to a parking.
 */
export async function createUploadUrl(
  objectKey: string,
  contentType: PhotoContentType,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: objectKey,
    ContentType: contentType,
  });
  return getSignedUrl(client(), command, { expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/**
 * Server-side PUT of a buffer we produced ourselves (not a browser upload) —
 * used for the booking QR, which the mail template references by URL because the
 * mail API carries no attachments. Returns the object's public URL.
 */
export async function putObject(
  objectKey: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: objectKey,
      Body: body,
      ContentType: contentType,
      // The mail client fetches this straight from storage, so it has to be
      // readable without a signature.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return publicUrl(objectKey);
}

export type ObjectHead = {
  contentType: string | undefined;
  contentLength: number;
};

export async function headObject(objectKey: string): Promise<ObjectHead | null> {
  try {
    const result = await client().send(
      new HeadObjectCommand({ Bucket: bucket(), Key: objectKey }),
    );
    return {
      contentType: result.ContentType,
      contentLength: result.ContentLength ?? 0,
    };
  } catch {
    return null;
  }
}

export async function deleteObject(objectKey: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: objectKey }));
}
