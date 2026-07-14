import type { NextRequest } from "next/server";
import { createEvent, listEvents } from "@/modules/admin/events";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return listEvents(searchParamsToObject(request.url));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body: unknown = await request.json().catch(() => ({}));
    return createEvent(body);
  });
}
