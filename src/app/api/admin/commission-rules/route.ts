import type { NextRequest } from "next/server";
import { listCommissionRules, setCommissionRule } from "@/modules/admin/commissions";
import { handle } from "@/modules/admin/http";
import { requireAdmin } from "@/modules/admin/session";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    return listCommissionRules();
  });
}

/** A new rate is a new version, not an UPDATE — settled bookings keep their own. */
export async function PUT(request: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const body: unknown = await request.json().catch(() => ({}));
    return setCommissionRule(body);
  });
}
