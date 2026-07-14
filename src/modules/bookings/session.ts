import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getSession } from "@/lib/session";

/**
 * Buying without an account is the whole point of the checkout flow
 * (DESIGN_PRINCIPLES §7, path 1) — but the driver still has to reach their own
 * QR code afterwards, and nobody else's.
 *
 * So a guest gets a signed, httpOnly cookie listing the bookings this browser
 * created. It is not a session: it grants read + cancel on those ids and nothing
 * else. Booking ids are UUIDv4 and therefore unguessable, but "unguessable" is
 * not an access control, and this is.
 *
 * Logged-in users are read through the auth module's session helper — there is
 * no second notion of identity in this codebase.
 */
const GRANT_COOKIE = "ps_booking_grants";
const GRANT_TTL_DAYS = 30;
const GRANT_PURPOSE = "BOOKING_ACCESS";
const MAX_GRANTS = 20;

function grantSecret(): Uint8Array {
  const value = process.env.ACTION_TOKEN_SECRET;
  if (!value) throw new Error("ACTION_TOKEN_SECRET is not set");
  return new TextEncoder().encode(value);
}

export async function readBookingGrants(): Promise<string[]> {
  const jar = await cookies();
  const token = jar.get(GRANT_COOKIE)?.value;
  if (!token) return [];

  try {
    const { payload } = await jwtVerify(token, grantSecret());
    if (payload.purpose !== GRANT_PURPOSE) return [];
    const ids = payload.ids;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export async function grantBookingAccess(bookingId: string): Promise<void> {
  const existing = await readBookingGrants();
  if (existing.includes(bookingId)) return;

  const ids = [bookingId, ...existing].slice(0, MAX_GRANTS);

  const token = await new SignJWT({ purpose: GRANT_PURPOSE, ids })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${GRANT_TTL_DAYS}d`)
    .sign(grantSecret());

  const jar = await cookies();
  jar.set(GRANT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GRANT_TTL_DAYS * 24 * 60 * 60,
  });
}

export type Viewer = {
  userId: string | null;
  grantedBookingIds: string[];
};

export async function getViewer(req?: Request): Promise<Viewer> {
  const [session, grantedBookingIds] = await Promise.all([getSession(req), readBookingGrants()]);
  return { userId: session?.userId ?? null, grantedBookingIds };
}

export function canViewBooking(viewer: Viewer, booking: { id: string; userId: string }): boolean {
  if (viewer.userId && viewer.userId === booking.userId) return true;
  return viewer.grantedBookingIds.includes(booking.id);
}
