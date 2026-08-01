import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://parkownia.com";

/**
 * There was no robots.txt at all (404), so nothing said which half of this site
 * is private. Everything behind a login is listed here as well as guarded, not
 * because a crawler could get in — it cannot — but because a 302 to /logowanie
 * indexed under a parking's name is noise nobody wants to explain later.
 *
 * /wypisz and /udostepnij carry one-shot tokens from e-mails. A crawler that
 * followed one would be acting on somebody else's link.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/panel",
        "/konto",
        "/moje-rezerwacje",
        "/rezerwacja/",
        "/wypisz/",
        "/udostepnij/",
      ],
    },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
