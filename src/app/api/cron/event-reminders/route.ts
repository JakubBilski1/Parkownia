import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { sendEventReminders } from "@/modules/events/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function authorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  return provided.length > 0 && secretsMatch(provided, expected);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!authorized(request)) {
    // No body: an unauthenticated caller learns nothing about this endpoint.
    return new NextResponse(null, { status: 401 });
  }

  const run = await sendEventReminders();
  return NextResponse.json(run);
}
