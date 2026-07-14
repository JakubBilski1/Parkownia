import { NextResponse } from "next/server";
import { notFound, toErrorResponse } from "@/lib/api";
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

    return NextResponse.json(event);
  } catch (error) {
    return toErrorResponse(error);
  }
}
