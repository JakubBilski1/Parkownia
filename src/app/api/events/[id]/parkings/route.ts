import { NextResponse } from "next/server";
import { notFound, toErrorResponse } from "@/lib/api";
import { listEventParkings } from "@/modules/events/parkings";
import { getEventById } from "@/modules/events/service";
import { eventIdSchema } from "@/modules/events/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const event = await getEventById(eventIdSchema.parse(id));
    if (!event) {
      throw notFound("Nie znaleźliśmy tego wydarzenia.");
    }

    return NextResponse.json({
      event: {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        searchRadiusMeters: event.searchRadiusMeters,
        venue: event.venue,
      },
      // Straight line x 1.3, not a routed walk. The flag travels with the numbers.
      isApproximate: true,
      items: await listEventParkings(event.id),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
