import { z } from "zod";
import { forbidden, handler } from "@/lib/api";
import { isHost, requireUser } from "@/lib/session";
import { resolveHostId } from "@/modules/host/identity";
import { listHostBookings } from "@/modules/scan/host-bookings";

const querySchema = z.object({
  date: z.enum(["today", "upcoming"]).default("today"),
});

/** GET /api/host/bookings?date=today|upcoming (docs/API_SPEC.md §8). */
export const GET = handler({
  input: querySchema,
  handle: async ({ input, req }) => {
    const session = await requireUser(req);

    // An employee reads their client's bookings — that is the list they work from
    // at the gate. They are not a host, so isHost() alone would lock them out.
    if (!isHost(session) && !session.roles.includes("HOST_EMPLOYEE")) {
      throw forbidden("To konto nie udostępnia jeszcze parkingów.");
    }

    const hostId = await resolveHostId(session.userId);
    if (!hostId) {
      throw forbidden("To konto pracownicze nie jest już przypisane do klienta.");
    }

    return { items: await listHostBookings(hostId, input.date) };
  },
});
