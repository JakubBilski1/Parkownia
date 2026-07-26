import { z } from "zod";
import { handler, notFound } from "@/lib/api";
import { buildScanManifest, listHostScanEvents } from "@/modules/scan/manifest";
import { requireScanContext } from "@/modules/scan/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  eventId: z.string().uuid().optional(),
});

/**
 * Without `eventId`: the events the host can pull codes for.
 * With `eventId`: the offline package — hashes only, no personal data, nothing
 * that turns a lost phone into a ticket printer.
 */
export const GET = handler({
  input: querySchema,
  source: "query",
  handle: async ({ input, req }) => {
    const { hostId } = await requireScanContext(req);

    if (!input.eventId) {
      return { items: await listHostScanEvents(hostId) };
    }

    const manifest = await buildScanManifest(hostId, input.eventId);
    if (!manifest) {
      throw notFound("Nie znamy takiego wydarzenia.");
    }

    return manifest;
  },
});
