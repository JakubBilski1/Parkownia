import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, badRequest, errorResponse } from "@/modules/parkings/errors";
import { parkingPatchSchema } from "@/modules/parkings/schemas";
import { getPublicParking, patchParking } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const idSchema = z.uuid();

const fromSchema = z
  .object({
    fromLat: z.coerce.number().min(-90).max(90),
    fromLng: z.coerce.number().min(-180).max(180),
  })
  .partial();

async function parkingId(context: Context): Promise<string> {
  const { id } = await context.params;
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) {
    throw new ApiError("NOT_FOUND", "Nie znaleźliśmy tego parkingu.");
  }
  return parsed.data;
}

/** Public. Never carries access_instructions or payout_bank_account — see service.ts. */
export async function GET(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const id = await parkingId(context);
    const query = fromSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));

    if (!query.success) {
      throw badRequest(query.error);
    }

    const { fromLat, fromLng } = query.data;
    const from =
      fromLat !== undefined && fromLng !== undefined ? { lat: fromLat, lng: fromLng } : undefined;

    return NextResponse.json(await getPublicParking(id, from));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Context): Promise<NextResponse> {
  try {
    const session = await requireHost(request);
    const id = await parkingId(context);
    const parsed = parkingPatchSchema.safeParse(await request.json());

    if (!parsed.success) {
      throw badRequest(parsed.error);
    }

    return NextResponse.json(await patchParking(session, id, parsed.data));
  } catch (error) {
    return errorResponse(error);
  }
}
