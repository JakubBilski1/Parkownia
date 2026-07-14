import type { NextRequest } from "next/server";
import { handle } from "@/modules/admin/http";
import { reviewParking } from "@/modules/admin/moderation";
import { requireAdmin } from "@/modules/admin/session";

type Params = { params: Promise<{ id: string }> };

/** `reason` missing on a REJECTED decision is a 422 — the rule lives in the module. */
export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    return reviewParking({ ...(body as Record<string, unknown>), parkingId: id });
  });
}
