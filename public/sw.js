/*
 * Parkownia Service Worker — the scanner shell, and nothing else.
 *
 * What it caches:
 *   - the scanner and host-panel HTML (so the app opens with the radio off),
 *   - Next.js build assets under /_next/static (immutable, content-hashed),
 *   - the web app manifest and icons.
 *
 * What it must NEVER cache:
 *   - anything under /api/ — payments, bookings, personal data, and the scan
 *     endpoints themselves. A cached scan verdict is a wrong scan verdict, and
 *     a cached payment response is a support ticket.
 *
 * The offline codes do not live here. They live in IndexedDB
 * (src/lib/offline/db.ts), hashed, put there deliberately by the host.
 */

const VERSION = "parkownia-scan-v1";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL_URLS = [
  "/panel/skaner",
  "/panel/rezerwacje",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Never cached, never served from cache. */
const NEVER_CACHE = ["/api/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: "reload" })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))) return;

  // Pages: network first (a fresh shell whenever there is a network), cache as
  // the fallback that makes the gate work in airplane mode.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached ?? (await caches.match("/panel/skaner")) ?? Response.error();
        }),
    );
    return;
  }

  // Build assets are content-hashed: if the URL is in the cache, it is correct.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
  }
});
