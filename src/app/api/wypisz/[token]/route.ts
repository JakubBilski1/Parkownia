import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/modules/admin/unsubscribe";

export const dynamic = "force-dynamic";

/**
 * Takes an address off the campaign list, for good.
 *
 * POST only. A GET here would be followed by every corporate link scanner and
 * inbox previewer that touches the message, and people would find themselves
 * unsubscribed from a mail they never opened — so the human path is the
 * confirmation page at /wypisz/[token], which posts here.
 *
 * This is also the endpoint a `List-Unsubscribe` header should name once the
 * mail API lets us set one (RFC 8058 one-click posts here with no body and
 * expects a 2xx). It is unauthenticated on purpose: possession of the token IS
 * the authorisation, and the worst a stolen token can do is stop mail.
 */
type RouteContext = { params: Promise<{ token: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const result = await unsubscribeByToken(token);

  if (!result.ok) {
    return NextResponse.json({ error: "Nie rozpoznajemy tego linku." }, { status: 404 });
  }

  // The address is not echoed back: this endpoint needs no authentication, so a
  // reply carrying the e-mail would turn a guessed token into an address leak.
  return NextResponse.json({ ok: true, alreadyOff: result.alreadyOff });
}
