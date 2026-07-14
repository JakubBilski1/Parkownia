import type { NextRequest } from "next/server";
import { handle } from "@/modules/admin/http";
import { markPayoutPaid } from "@/modules/admin/payouts";
import { requireAdmin } from "@/modules/admin/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const body: unknown = await request.json().catch(() => ({}));
    return markPayoutPaid({ ...(body as Record<string, unknown>), payoutId: id });
  });
}
