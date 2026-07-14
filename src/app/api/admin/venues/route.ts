import type { NextRequest } from "next/server";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";
import { createVenue, listVenues } from "@/modules/admin/venues";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return { items: await listVenues() };
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body: unknown = await request.json().catch(() => ({}));
    return createVenue(body);
  });
}
