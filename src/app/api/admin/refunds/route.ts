import type { NextRequest } from "next/server";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";
import { refundBooking } from "@/modules/admin/transactions";

/** Full or partial refund outside the cancellation policy (API_SPEC §6). */
export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body: unknown = await request.json().catch(() => ({}));
    return refundBooking(body);
  });
}
