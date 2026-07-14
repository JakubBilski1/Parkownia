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
 * The middleware bounces an expired-but-refreshable session here (see
 * src/middleware.ts): it cannot rotate tokens itself, because rotation needs
 * the database and the middleware runs on the Edge. This GET rotates and sends
 * the user on to where they were going. Rotation is the only effect — a
 * cross-site navigation that triggers it gains nothing.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  try {
    await rotate();
    return NextResponse.redirect(new URL(next, req.nextUrl.origin));
  } catch (error) {
    await clearAuthCookies();

    if (req.headers.get("accept")?.includes("text/html")) {
      const login = new URL("/logowanie", req.nextUrl.origin);
      login.searchParams.set("next", next);
      return NextResponse.redirect(login);
    }

    return toErrorResponse(error);
  }
}
