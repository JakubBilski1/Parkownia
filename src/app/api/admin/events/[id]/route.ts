import type { NextRequest } from "next/server";
import { deleteEvent, updateEvent } from "@/modules/admin/events";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    return updateEvent({ ...(body as Record<string, unknown>), eventId: id });
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    return deleteEvent(id);
  });
}
