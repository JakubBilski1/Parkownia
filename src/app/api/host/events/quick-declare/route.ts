import { NextResponse, type NextRequest } from "next/server";
import { AppError, invalidInput, toErrorResponse } from "@/lib/api";
import { quickDeclare, type QuickDeclareFailure } from "@/modules/events/quick-declare";
import { quickDeclareSchema } from "@/modules/events/validation";

export const dynamic = "force-dynamic";

const FAILURE: Record<QuickDeclareFailure, () => AppError> = {
  TOKEN_INVALID: () =>
    new AppError(
      "TOKEN_INVALID",
      404,
      "Nie rozpoznajemy tego linku. Zaloguj się i ustaw dostępność w panelu hosta.",
    ),
  TOKEN_USED: () =>
    new AppError("TOKEN_USED", 409, "Ten link został już użyty. Decyzję zmienisz w panelu hosta."),
  TOKEN_EXPIRED: () =>
    new AppError("TOKEN_EXPIRED", 410, "Wydarzenie już się zaczęło — ten link wygasł."),
  PARKING_NOT_OWNED: () => new AppError("FORBIDDEN", 403, "To nie jest Twój parking."),
};

/** No session: the one-shot token from the e-mail is the whole authentication. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => {
      throw invalidInput("Nie udało się odczytać danych żądania.");
    });
    const input = quickDeclareSchema.parse(body);

    const result = await quickDeclare(input);
    if (!result.ok) {
      throw FAILURE[result.reason]();
    }

    return NextResponse.json({
      accepted: result.value.accepted,
      eventId: result.value.offer.eventId,
      parkingId: result.value.offer.parkingId,
      spots: result.value.accepted ? result.value.offer.spots : null,
      priceGr: result.value.accepted ? result.value.offer.priceGr : null,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
