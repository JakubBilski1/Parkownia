import { NextResponse, type NextRequest } from "next/server";
import { forbidden, toErrorResponse } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { listHostEvents } from "@/modules/events/availability";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await requireUser(request);
    if (!isHost(session)) {
      throw forbidden("To konto nie udostępnia parkingów.");
    }

    return NextResponse.json({ items: await listHostEvents(session.userId) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
