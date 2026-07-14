import { NextResponse, type NextRequest } from "next/server";
import { forbidden, invalidInput, notFound, toErrorResponse } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { declareAvailability } from "@/modules/events/availability";
import { getEventById } from "@/modules/events/service";
import { declareAvailabilitySchema, eventIdSchema } from "@/modules/events/validation";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ eventId: string }> },
): Promise<NextResponse> {
  try {
    const session = await requireUser(request);
    if (!isHost(session)) {
      throw forbidden("To konto nie udostępnia parkingów.");
    }

    const { eventId } = await context.params;
    const event = await getEventById(eventIdSchema.parse(eventId));
    if (!event) {
      throw notFound("Nie znaleźliśmy tego wydarzenia.");
    }

    const body: unknown = await request.json().catch(() => {
      throw invalidInput("Nie udało się odczytać danych żądania.");
    });
    const input = declareAvailabilitySchema.parse(body);

    const result = await declareAvailability({
      hostId: session.userId,
      eventId: event.id,
      parkingId: input.parkingId,
      isAvailable: input.isAvailable,
      spots: input.spots,
      priceGr: input.priceGr,
      notes: input.notes,
    });

    if (!result.ok) {
      throw forbidden("To nie jest Twój parking.");
    }

    return NextResponse.json({
      eventId: event.id,
      parkingId: input.parkingId,
      isAvailable: result.isAvailable,
      spots: result.spots,
      priceGr: result.priceGr,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
