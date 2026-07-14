import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/modules/parkings/errors";
import { deletePhoto } from "@/modules/parkings/photos";
import { assertOwnership } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const session = await requireHost(request);
    const { id, photoId } = await context.params;

    if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(photoId).success) {
      throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego zdjęcia.");
    }

    await assertOwnership(session, id);
    await deletePhoto(id, photoId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
