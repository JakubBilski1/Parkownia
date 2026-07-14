import { AsyncLocalStorage } from "node:async_hooks";

/**
 * `next/headers` reads the incoming request from an async context that only the
 * Next.js server ever enters. Route handlers called straight from a test are
 * outside it, and `cookies()` throws.
 *
 * So the tests re-create the context — with AsyncLocalStorage, the way Next does,
 * which is what makes it safe to run ten route handlers concurrently and have
 * each of them see its own cookie jar. Nothing else about the route is faked:
 * the handler, the Zod schema, the session parsing, the services and the database
 * are all real. The stub ends at the cookie jar.
 */

export type RequestScope = {
  cookies: Map<string, string>;
  headers: Headers;
};

const storage = new AsyncLocalStorage<RequestScope>();

/** An unauthenticated request with no cookies — what an anonymous visitor is. */
function anonymous(): RequestScope {
  return { cookies: new Map(), headers: new Headers() };
}

export function currentScope(): RequestScope {
  return storage.getStore() ?? anonymous();
}

export function runInRequestScope<T>(
  init: { cookies?: Record<string, string>; headers?: Record<string, string> },
  fn: () => Promise<T>,
): Promise<T> {
  const scope: RequestScope = {
    cookies: new Map(Object.entries(init.cookies ?? {})),
    headers: new Headers(init.headers ?? {}),
  };
  return storage.run(scope, fn);
}

type CookieRecord = { name: string; value: string };

/** The slice of Next's ReadonlyRequestCookies / ResponseCookies that this app uses. */
export function cookieStore() {
  const { cookies } = currentScope();

  return {
    get(name: string): CookieRecord | undefined {
      const value = cookies.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll(): CookieRecord[] {
      return [...cookies].map(([name, value]) => ({ name, value }));
    },
    has(name: string): boolean {
      return cookies.has(name);
    },
    set(name: string | { name: string; value: string }, value?: string) {
      if (typeof name === "object") cookies.set(name.name, name.value);
      else cookies.set(name, value ?? "");
      return this;
    },
    delete(name: string) {
      cookies.delete(name);
      return this;
    },
  };
}
