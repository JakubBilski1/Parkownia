import { NextResponse, type NextRequest } from "next/server";
import { toErrorResponse } from "@/lib/api";
import { listAllEvents, listUpcomingEvents } from "@/modules/events/service";
import { listEventsQuerySchema } from "@/modules/events/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const query = listEventsQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams),
    );

    const items = query.upcoming
      ? await listUpcomingEvents(query.limit)
      : await listAllEvents(query.limit);

    return NextResponse.json({ items });
  } catch (error) {
    return toErrorResponse(error);
  }
}
