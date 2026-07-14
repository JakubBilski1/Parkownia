import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookie-names";
import { ACCESS_TOKEN_TTL_SECONDS } from "./jwt";

export { ACCESS_COOKIE, REFRESH_COOKIE };

/**
 * Both tokens live in httpOnly cookies. The access token is *also* returned in
 * the response body (docs/API_SPEC.md) for clients that send it as a Bearer
 * header; the cookie copy is what lets Server Components and the middleware
 * read the session without a round-trip to the database.
 *
 * SameSite=Lax, so a cross-site POST cannot ride the session, while a normal
 * top-level navigation into /panel still arrives authenticated.
 */
const BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const;

export async function setAuthCookies(input: {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}): Promise<void> {
  const store = await cookies();

  store.set(ACCESS_COOKIE, input.accessToken, {
    ...BASE,
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
  });

  store.set(REFRESH_COOKIE, input.refreshToken, {
    ...BASE,
    expires: input.refreshExpiresAt,
  });
}

export async function clearAuthCookies(): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, "", { ...BASE, maxAge: 0 });
  store.set(REFRESH_COOKIE, "", { ...BASE, maxAge: 0 });
}

export async function readRefreshCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
