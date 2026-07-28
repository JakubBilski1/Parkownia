import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/modules/auth/cookie-names";
import { verifyAccessToken } from "@/modules/auth/jwt";

/**
 * Two jobs. The gate on /panel (host) and /admin (admin), and — everywhere —
 * keeping a logged-in session alive. This runs on the Edge runtime, so it
 * verifies the access token's signature and roles and never touches the
 * database; the authoritative ownership checks happen in the route handlers.
 *
 * The access token lives 15 minutes and its cookie expires with it, while the
 * refresh token is good for seven days. Rotation cannot happen here (it needs
 * the database), so a request that arrives with a dead access cookie and a live
 * refresh cookie is bounced through /api/auth/refresh, which rotates the pair
 * and sends the user back to where they were going.
 *
 * That bounce used to be wired to /panel and /admin only, which is what made a
 * signed-in owner look signed out everywhere else fifteen minutes after logging
 * in: the landing, /konto and the map read a cookie the browser had already
 * dropped, found nothing, and drew the "Zaloguj się" button. The refresh token
 * was sitting in the same browser the whole time.
 *
 * On a public page the bounce is SOFT: a failed rotation drops the dead cookies
 * and carries on as an anonymous visitor. Nobody reading the landing page gets
 * shoved into a login form because a week-old token expired.
 */

const LOGIN_PATH = "/logowanie";
const REFRESH_PATH = "/api/auth/refresh";

/** Everything behind the gate. Anything else is public and may be read signed out. */
const PROTECTED_PREFIXES = ["/panel", "/admin"];
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

/** Bounce through the rotation endpoint and come back here. */
function refreshThenReturn(req: NextRequest, next: string, soft: boolean): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = REFRESH_PATH;
  url.search = "";
  url.searchParams.set("next", next);
  // Tells the endpoint what to do when rotation fails: a public page continues
  // as anonymous, a guarded one asks for a login.
  if (soft) url.searchParams.set("soft", "1");
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const target = `${pathname}${search}`;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;

  if (!claims) {
    const refreshable = Boolean(req.cookies.get(REFRESH_COOKIE));

    if (!isProtected) {
      // Only ever on a plain navigation. A redirect answering a POST would throw
      // the body away, and a rotation is not worth that.
      return refreshable && req.method === "GET"
        ? refreshThenReturn(req, target, true)
        : NextResponse.next();
    }

    return refreshable
      ? refreshThenReturn(req, target, false)
      : redirectTo(req, LOGIN_PATH, target);
  }

  if (!isProtected) return NextResponse.next();

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
  /**
   * Every page, so a session can be revived wherever the user happens to be —
   * not just behind the gate. Excluded: the API (including the rotation
   * endpoint itself, which would otherwise redirect to itself), the build
   * output, and the static files served from /public.
   */
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js).*)",
  ],
};
