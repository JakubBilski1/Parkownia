import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://parkownia.com";

/**
 * The public routes, listed by hand.
 *
 * Event pages are deliberately absent even though they are the best SEO on the
 * site. Reading them means a database query, and `next build` has to pass with
 * no environment at all (see 36779b0 — the build broke exactly this way once).
 * When events belong in here, they need a route that fetches at request time,
 * not a build-time list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/mapa`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/wydarzenia`, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/regulamin`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/prywatnosc`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
