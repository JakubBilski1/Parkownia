import { NextResponse, type NextRequest } from "next/server";
import { handler, toErrorResponse } from "@/lib/api";
import { clearAuthCookies, readRefreshCookie, setAuthCookies } from "@/modules/auth/cookies";
import { refreshSession } from "@/modules/auth/service";

async function rotate() {
  const session = await refreshSession(await readRefreshCookie());

  await setAuthCookies({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    refreshExpiresAt: session.refreshExpiresAt,
  });

  return session;
}

export const POST = handler({
  handle: async () => {
    try {
      const session = await rotate();
      return { user: session.user, accessToken: session.accessToken };
    } catch (error) {
      // A refresh token that no longer works is a dead cookie; leaving it in the
      // browser would send the user through this endpoint on every navigation.
      await clearAuthCookies();
      throw error;
    }
  },
});

/** Only a path inside this app, never an absolute URL — no open redirect. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

/**
 * A RELATIVE Location, resolved by the browser against the address it is
 * already on. `NextResponse.redirect()` demands an absolute URL, and the only
 * origin this handler can see is the one the container is bound to — behind
 * Coolify's proxy that is http://0.0.0.0:3000, which is where production
 * actually sent people: a host whose fifteen-minute token expired was bounced
 * here, rotated fine, and then redirected to an address that exists nowhere
 * outside the container.
 *
 * Guessing the public origin from X-Forwarded-* would work, but it means
 * trusting headers to build a redirect. A relative Location needs no origin at
 * all and cannot leak an internal one (RFC 7231 §7.1.2).
 *
 * Cookies set through next/headers during this request are still merged into
 * this response by Next — the rotation and the clearing both survive.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

/**
 * The middleware bounces an expired-but-refreshable session here (see
 * src/middleware.ts): it cannot rotate tokens itself, because rotation needs
 * the database and the middleware runs on the Edge. This GET rotates and sends
 * the user on to where they were going. Rotation is the only effect — a
 * cross-site navigation that triggers it gains nothing.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  /**
   * A soft bounce comes from a PUBLIC page: the visitor was only passing
   * through, and a refresh token that turned out to be dead is no reason to
   * demand a login before they can read the landing. The cookies are cleared
   * either way, which is also what stops the next request bouncing here again.
   */
  const soft = req.nextUrl.searchParams.get("soft") === "1";

  try {
    await rotate();
    return redirectTo(next);
  } catch (error) {
    await clearAuthCookies();

    if (soft) {
      return redirectTo(next);
    }

    if (req.headers.get("accept")?.includes("text/html")) {
      return redirectTo(`/logowanie?next=${encodeURIComponent(next)}`);
    }

    return toErrorResponse(error);
  }
}
