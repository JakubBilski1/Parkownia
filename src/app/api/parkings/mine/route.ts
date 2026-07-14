import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/modules/parkings/errors";
import { listMyParkings } from "@/modules/parkings/service";
import { requireHost } from "@/modules/parkings/session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireHost(request);
    const items = await listMyParkings(session);
    return NextResponse.json({ items });
  } catch (error) {
    return errorResponse(error);
  }
}
