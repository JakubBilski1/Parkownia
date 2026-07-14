import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, errorResponse } from "@/modules/parkings/errors";
import { resumeParking } from "@/modules/parkings/service";
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

    return NextResponse.json(await resumeParking(session, id));
  } catch (error) {
    return errorResponse(error);
  }
}
