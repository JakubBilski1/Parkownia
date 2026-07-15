export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
  city: string | null;
  postcode: string | null;
};

export interface Geocoder {
  readonly name: string;
  search(query: string, limit?: number): Promise<GeocodeResult[]>;
  reverse(lat: number, lng: number): Promise<GeocodeResult | null>;
}

/** Poznań and its ring road. Results outside it are still returned, only ranked lower. */
const POZNAN_VIEWBOX = { west: 16.73, south: 52.29, east: 17.11, north: 52.51 };
const REQUEST_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

class GeocoderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeocoderError";
  }
}

type CacheEntry = { at: number; value: GeocodeResult[] };

// Process-local cache. A single Node process serves the whole app (monolith), so
// a Map is the whole cache layer until Redis exists — and the geocoders we can
// afford are rate-limited far below our traffic.
const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): GeocodeResult[] | null {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: GeocodeResult[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { at: Date.now(), value });
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new GeocoderError(`Geocoder responded ${response.status}`);
  }
  return response.json();
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/* -------------------------------------------------------------------------- */
/* Nominatim — development only                                               */
/* -------------------------------------------------------------------------- */

type NominatimPlace = {
  display_name?: unknown;
  lat?: unknown;
  lon?: unknown;
  address?: Record<string, unknown>;
};

function nominatimResult(place: NominatimPlace): GeocodeResult | null {
  const lat = toNumber(place.lat);
  const lng = toNumber(place.lon);
  if (lat === null || lng === null) return null;

  const address = place.address ?? {};
  const city = address.city ?? address.town ?? address.village ?? address.municipality;

  return {
    label: typeof place.display_name === "string" ? place.display_name : `${lat}, ${lng}`,
    lat,
    lng,
    city: typeof city === "string" ? city : null,
    postcode: typeof address.postcode === "string" ? address.postcode : null,
  };
}

/**
 * Nominatim's usage policy allows at most one request per second and forbids
 * production volume entirely. The queue below makes the limit structural rather
 * than a promise we intend to keep: every call waits its turn behind the last one.
 */
class NominatimGeocoder implements Geocoder {
  readonly name = "nominatim";
  private readonly base: string;
  private queue: Promise<unknown> = Promise.resolve();
  private lastCallAt = 0;

  constructor(base: string) {
    this.base = base.replace(/\/$/, "");
  }

  private throttle<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = 1000 - (Date.now() - this.lastCallAt);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastCallAt = Date.now();
      return task();
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async search(query: string, limit = 5): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      countrycodes: "pl",
      limit: String(limit),
      viewbox: `${POZNAN_VIEWBOX.west},${POZNAN_VIEWBOX.north},${POZNAN_VIEWBOX.east},${POZNAN_VIEWBOX.south}`,
    });

    const payload = await this.throttle(() =>
      fetchJson(`${this.base}/search?${params}`, {
        // Nominatim rejects requests without an identifying User-Agent.
        "User-Agent": "Parkownia/0.1 (parking marketplace, Poznan)",
        "Accept-Language": "pl",
      }),
    );

    if (!Array.isArray(payload)) return [];
    return payload
      .map((place) => nominatimResult(place as NominatimPlace))
      .filter((result): result is GeocodeResult => result !== null);
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      format: "jsonv2",
      addressdetails: "1",
    });

    const payload = await this.throttle(() =>
      fetchJson(`${this.base}/reverse?${params}`, {
        "User-Agent": "Parkownia/0.1 (parking marketplace, Poznan)",
        "Accept-Language": "pl",
      }),
    );

    if (!payload || typeof payload !== "object") return null;
    return nominatimResult(payload as NominatimPlace);
  }
}

/* -------------------------------------------------------------------------- */
/* Geoapify — production                                                      */
/* -------------------------------------------------------------------------- */

type GeoapifyFeature = {
  properties?: {
    formatted?: unknown;
    lat?: unknown;
    lon?: unknown;
    city?: unknown;
    postcode?: unknown;
  };
};

function geoapifyResult(feature: GeoapifyFeature): GeocodeResult | null {
  const properties = feature.properties ?? {};
  const lat = toNumber(properties.lat);
  const lng = toNumber(properties.lon);
  if (lat === null || lng === null) return null;

  return {
    label: typeof properties.formatted === "string" ? properties.formatted : `${lat}, ${lng}`,
    lat,
    lng,
    city: typeof properties.city === "string" ? properties.city : null,
    postcode: typeof properties.postcode === "string" ? properties.postcode : null,
  };
}

class GeoapifyGeocoder implements Geocoder {
  readonly name = "geoapify";
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string, limit = 5): Promise<GeocodeResult[]> {
    const params = new URLSearchParams({
      text: query,
      lang: "pl",
      limit: String(limit),
      filter: "countrycode:pl",
      bias: `proximity:${(POZNAN_VIEWBOX.west + POZNAN_VIEWBOX.east) / 2},${(POZNAN_VIEWBOX.south + POZNAN_VIEWBOX.north) / 2}`,
      apiKey: this.apiKey,
    });

    const payload = await fetchJson(`https://api.geoapify.com/v1/geocode/search?${params}`, {});
    const features = (payload as { features?: unknown }).features;
    if (!Array.isArray(features)) return [];

    return features
      .map((feature) => geoapifyResult(feature as GeoapifyFeature))
      .filter((result): result is GeocodeResult => result !== null);
  }

  async reverse(lat: number, lng: number): Promise<GeocodeResult | null> {
    const params = new URLSearchParams({
      lat: String(lat),
      lon: String(lng),
      lang: "pl",
      apiKey: this.apiKey,
    });

    const payload = await fetchJson(`https://api.geoapify.com/v1/geocode/reverse?${params}`, {});
    const features = (payload as { features?: unknown }).features;
    if (!Array.isArray(features) || features.length === 0) return null;

    return geoapifyResult(features[0] as GeoapifyFeature);
  }
}

/* -------------------------------------------------------------------------- */
/* Selection + caching facade                                                 */
/* -------------------------------------------------------------------------- */

let instance: Geocoder | null = null;

function build(): Geocoder {
  const provider = process.env.GEOCODER ?? "nominatim";

  if (provider === "geoapify") {
    const key = process.env.GEOAPIFY_KEY;
    if (!key) {
      throw new GeocoderError("GEOCODER=geoapify but GEOAPIFY_KEY is empty.");
    }
    return new GeoapifyGeocoder(key);
  }

  return new NominatimGeocoder(
    process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org",
  );
}

export function getGeocoder(): Geocoder {
  instance ??= build();
  return instance;
}

export async function geocode(query: string, limit = 5): Promise<GeocodeResult[]> {
  const geocoder = getGeocoder();
  const key = `${geocoder.name}:s:${limit}:${query.trim().toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  const results = await geocoder.search(query, limit);
  cacheSet(key, results);
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodeResult | null> {
  const geocoder = getGeocoder();
  // ~11 m of precision: a pin nudged by a few metres must not miss the cache.
  const key = `${geocoder.name}:r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached) return cached[0] ?? null;

  const result = await geocoder.reverse(lat, lng);
  cacheSet(key, result ? [result] : []);
  return result;
}

export { GeocoderError };
