import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/modules/auth/cookie-names";
import { verifyAccessToken } from "@/modules/auth/jwt";

/**
 * Gate on /panel (host) and /admin (admin). This runs on the Edge runtime, so
 * it verifies the access token's signature and roles and never touches the
 * database — the authoritative ownership checks happen in the route handlers.
 *
 * The access token lives 15 minutes; a host who leaves a tab open for an hour
 * must not be thrown back to the login form. When the access cookie is gone but
 * a refresh cookie is still there, we bounce through the refresh endpoint,
 * which rotates the pair and returns the user to where they were heading.
 */

const LOGIN_PATH = "/logowanie";
const HOST_ONBOARDING_PATH = "/zostan-hostem";

/** What a HOST_EMPLOYEE may open under /panel. Everything else bounces to the scanner. */
const EMPLOYEE_PATHS = ["/panel/skaner", "/panel/rezerwacje"];
const EMPLOYEE_HOME = "/panel/skaner";

function redirectTo(req: NextRequest, path: string, next?: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const target = `${pathname}${search}`;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;

  if (!claims) {
    if (req.cookies.get(REFRESH_COOKIE)) {
      return redirectTo(req, "/api/auth/refresh", target);
    }
    return redirectTo(req, LOGIN_PATH, target);
  }

  if (pathname.startsWith("/admin")) {
    if (!claims.roles.includes("ADMIN")) {
      // Not "403 forbidden": telling a stranger that /admin exists and is real
      // is free reconnaissance.
      return NextResponse.rewrite(new URL("/404", req.url));
    }
    return NextResponse.next();
  }

  const isHost =
    claims.roles.includes("HOST_INDIVIDUAL") || claims.roles.includes("HOST_BUSINESS");

  if (isHost) {
    return NextResponse.next();
  }

  // A client's employee: the gate and the list they work from, nothing else.
  // Prices, the parking form and payouts belong to the party with the contract.
  // This is a coarse filter on claims — Edge has no database — and the pages and
  // routes behind it check ownership properly (modules/host/identity.ts).
  if (claims.roles.includes("HOST_EMPLOYEE")) {
    const allowed = EMPLOYEE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );
    return allowed ? NextResponse.next() : redirectTo(req, EMPLOYEE_HOME);
  }

  return redirectTo(req, HOST_ONBOARDING_PATH);
}

export const config = {
  matcher: ["/panel/:path*", "/admin/:path*"],
};
