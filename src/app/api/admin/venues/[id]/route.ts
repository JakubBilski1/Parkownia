import type { NextRequest } from "next/server";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";
import { deleteVenue, updateVenue } from "@/modules/admin/venues";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    return updateVenue({ ...(body as Record<string, unknown>), venueId: id });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    return deleteVenue(id);
  });
}
