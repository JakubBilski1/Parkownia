/**
 * Names only, in a leaf module with no imports.
 *
 * The middleware runs on the Edge runtime and needs these constants — importing
 * them from `cookies.ts` would drag `next/headers` (a Node-only API) into the
 * Edge bundle.
 */
export const ACCESS_COOKIE = "ps_access";
export const REFRESH_COOKIE = "ps_refresh";
