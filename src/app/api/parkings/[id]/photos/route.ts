import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, badRequest, errorResponse } from "@/modules/parkings/errors";
import { createPhotoUpload, listPhotos } from "@/modules/parkings/photos";
import { photoUploadSchema } from "@/modules/parkings/schemas";
import { assertOwnership } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

async function ownedParkingId(request: NextRequest, context: Context): Promise<string> {
  const session = await requireHost(request);
  const { id } = await context.params;

  if (!z.uuid().safeParse(id).success) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }

  await assertOwnership(session, id);
  return id;
}

export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const id = await ownedParkingId(request, context);
    return NextResponse.json({ items: await listPhotos(id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Returns a presigned PUT. The photo goes browser → storage; it never passes
 * through this process. The upload is only linked to the parking once the browser
 * calls POST …/photos/confirm, which re-checks type and size server-side.
 */
export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const id = await ownedParkingId(request, context);
    const parsed = photoUploadSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw badRequest(parsed.error);
    }

    const ticket = await createPhotoUpload(id, parsed.data.contentType);
    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
