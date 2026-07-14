import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, badRequest, errorResponse } from "@/modules/parkings/errors";
import { confirmPhoto } from "@/modules/parkings/photos";
import { photoConfirmSchema } from "@/modules/parkings/schemas";
import { assertOwnership } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const session = await requireHost(request);
    const { id } = await context.params;

    if (!z.uuid().safeParse(id).success) {
      throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
    }

    await assertOwnership(session, id);

    const parsed = photoConfirmSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw badRequest(parsed.error);
    }

    return NextResponse.json(await confirmPhoto(id, parsed.data), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
