import { NextResponse } from "next/server";
import { reconcilePendingPayments } from "@/modules/payments/reconcile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Every 10 minutes. Asks the PSP about intents that went quiet for more than
 * five (docs/PAYMENTS.md §3.2) — the answer to "the driver was charged and our
 * screen still says unpaid".
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (!authorized(request)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }

  const result = await reconcilePendingPayments();
  return NextResponse.json(result);
}

export const GET = POST;
