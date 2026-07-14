import type { NextRequest } from "next/server";
import { handle, searchParamsToObject } from "@/modules/admin/http";
import { generatePayouts, getPayoutReport } from "@/modules/admin/payouts";
import { requireAdmin } from "@/modules/admin/session";

/** "Kto ile dostaje w tym tygodniu": open payouts plus everything not on one yet. */
export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    return getPayoutReport(searchParamsToObject(request.url));
  });
}

/**
 * Not in API_SPEC §9 (integration item): mark-paid needs rows to mark, and only
 * this turns settleable bookings into payouts. Idempotent by construction.
 */
export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body: unknown = await request.json().catch(() => ({}));
    return generatePayouts(body);
  });
}
