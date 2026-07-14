import { z } from "zod";
import { forbidden, handler } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { listHostBookings } from "@/modules/scan/host-bookings";

const querySchema = z.object({
  date: z.enum(["today", "upcoming"]).default("today"),
});

/** GET /api/host/bookings?date=today|upcoming (docs/API_SPEC.md §8). */
export const GET = handler({
  input: querySchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);
    if (!isHost(session)) {
      throw forbidden("To konto nie udostępnia jeszcze parkingów.");
    }

    return { items: await listHostBookings(session.userId, input.date) };
  },
});
