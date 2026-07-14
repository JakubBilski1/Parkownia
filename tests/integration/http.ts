import { NextRequest } from "next/server";
import { POST as bookingsRoute } from "@/app/api/bookings/route";
import { GET as bookingDetailRoute } from "@/app/api/bookings/[id]/route";
import { GET as parkingDetailRoute } from "@/app/api/parkings/[id]/route";
import { POST as paymentIntentRoute } from "@/app/api/payments/intent/route";
import { POST as webhookRoute } from "@/app/api/webhooks/[provider]/route";
import { signAccessToken } from "@/modules/auth/jwt";
import { ACCESS_COOKIE } from "@/modules/auth/cookie-names";
import { runInRequestScope } from "./request-scope";

/**
 * The real route handlers, called the way Next calls them. Nothing here
 * re-implements a route: the Zod schemas, the session parsing, the rate limiter,
 * the services and the error mapping all execute. The status codes these helpers
 * return are the status codes a driver's phone would get.
 */

export type ApiResponse<T = unknown> = {
  status: number;
  body: T;
  /** The response body as raw text — for asserting a secret is nowhere in it. */
  raw: string;
};

async function read<T>(response: Response): Promise<ApiResponse<T>> {
  const raw = await response.text();
  return {
    status: response.status,
    raw,
    body: (raw ? JSON.parse(raw) : null) as T,
  };
}

/**
 * POST /api/bookings is rate limited to 10/min per user, and per IP for guests
 * (API_SPEC §0). Ten concurrent buyers racing for one spot are ten different
 * people standing in the same car park, not one script — so they get ten
 * addresses. Anything else and this suite would be testing the rate limiter.
 *
 * 198.51.100.0/24 is TEST-NET-2 (RFC 5737): reserved for documentation, routable
 * nowhere.
 */
let ipCounter = 0;

export function nextTestIp(): string {
  ipCounter = (ipCounter + 1) % 250;
  return `198.51.100.${ipCounter + 1}`;
}

type Scope = { cookies?: Record<string, string>; ip?: string };

function headersFor(scope: Scope): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-forwarded-for": scope.ip ?? nextTestIp(),
  };
}

/** An authenticated cookie jar for `userId` — a real signed access token. */
export async function sessionCookie(
  userId: string,
  roles: ("DRIVER" | "HOST_INDIVIDUAL" | "HOST_BUSINESS" | "ADMIN")[] = ["DRIVER"],
): Promise<Record<string, string>> {
  return { [ACCESS_COOKIE]: await signAccessToken({ userId, roles }) };
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

export type BookingRequestBody = {
  parkingId: string;
  eventId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  spots?: number;
  contact: { email: string; phone: string };
  consents: { terms: true; privacy: true; marketingEmail?: boolean };
};

export async function postBooking(
  body: BookingRequestBody,
  scope: Scope = {},
): Promise<ApiResponse<{ bookingId: string; priceGr: number } & { error?: { code: string } }>> {
  const headers = headersFor(scope);

  return runInRequestScope({ cookies: scope.cookies, headers }, async () => {
    const request = new Request("http://localhost/api/bookings", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return read(await bookingsRoute(request));
  });
}

export async function postPaymentIntent(
  body: { bookingId: string; method: "BLIK" | "CARD" },
  scope: Scope = {},
): Promise<ApiResponse<{ providerRef: string; amountGr: number; simulated: boolean }>> {
  const headers = headersFor(scope);

  return runInRequestScope({ cookies: scope.cookies, headers }, async () => {
    const request = new Request("http://localhost/api/payments/intent", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    return read(await paymentIntentRoute(request));
  });
}

export type MockWebhookBody = {
  id: string;
  type: "PAYMENT_SUCCEEDED" | "PAYMENT_FAILED" | "PAYMENT_REFUNDED";
  providerRef?: string;
  bookingId?: string;
  failureReason?: string;
};

export type WebhookResponse = { received: boolean; duplicate?: boolean; outcome?: string };

/** POST /api/webhooks/mock — the same handler, parser and idempotency Stripe hits. */
export async function postWebhook(
  body: MockWebhookBody,
  provider = "mock",
): Promise<ApiResponse<WebhookResponse>> {
  return postRawWebhook(JSON.stringify(body), provider);
}

/**
 * The body as bytes, unserialised. A signature is computed over bytes, so the
 * route reads text() and never json() — and only a raw body can be malformed
 * enough to test that.
 */
export async function postRawWebhook(
  rawBody: string,
  provider = "mock",
): Promise<ApiResponse<WebhookResponse>> {
  return runInRequestScope({}, async () => {
    const request = new Request(`http://localhost/api/webhooks/${provider}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: rawBody,
    });
    return read(await webhookRoute(request, { params: Promise.resolve({ provider }) }));
  });
}

export async function getParking(
  parkingId: string,
  scope: Scope = {},
): Promise<ApiResponse<Record<string, unknown>>> {
  return runInRequestScope({ cookies: scope.cookies, headers: headersFor(scope) }, async () => {
    const request = new NextRequest(`http://localhost/api/parkings/${parkingId}`);
    return read(await parkingDetailRoute(request, { params: Promise.resolve({ id: parkingId }) }));
  });
}

export type BookingDetailBody = {
  id: string;
  status: string;
  code: string | null;
  qrDataUrl: string | null;
  accessInstructions: string | null;
  entranceLocation: { lat: number; lng: number } | null;
  entranceNotes: string | null;
  error?: { code: string };
};

export async function getBookingDetail(
  bookingId: string,
  scope: Scope = {},
): Promise<ApiResponse<BookingDetailBody>> {
  return runInRequestScope({ cookies: scope.cookies, headers: headersFor(scope) }, async () => {
    const request = new Request(`http://localhost/api/bookings/${bookingId}`);
    return read(await bookingDetailRoute(request, { params: Promise.resolve({ id: bookingId }) }));
  });
}
