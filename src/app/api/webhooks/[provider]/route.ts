import { NextResponse } from "next/server";
import { handleWebhook } from "@/modules/payments/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/{provider}
 *
 * The body is read as raw text, never as JSON: a signature is computed over
 * bytes, and `request.json()` would have already thrown them away.
 *
 * Answers fast and answers 200 for anything it understood — including
 * duplicates and events it does not care about. A 500 here means Stripe retries
 * for three days, so the only things that get one are genuine failures to
 * process a payment we do care about.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await context.params;
  const rawBody = await request.text();

  try {
    const { status, body } = await handleWebhook(provider, rawBody, request.headers);
    return NextResponse.json(body, { status });
  } catch (error) {
    // No payload, no PII — the id of the booking is the most we ever log.
    console.error(`[webhooks/${provider}] processing failed`, error);
    return NextResponse.json({ received: false, error: "PROCESSING_FAILED" }, { status: 500 });
  }
}
