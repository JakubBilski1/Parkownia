/**
 * Every href the shell links to, in one place — and every one of them resolves to
 * a page that exists. They did not before integration: the map's "Zarezerwuj"
 * button pointed at /rezerwuj/:id, which was never built, so the single most
 * important click in the product was a 404.
 *
 * The /rezerwacja segment means two different things by depth, which is a Next.js
 * constraint (one slug name per level), so it is spelled out here rather than
 * rediscovered at each call site:
 *   /rezerwacja/:parkingId               → checkout (pick window, pay)
 *   /rezerwacja/:bookingId/potwierdzenie → the ticket: code, QR, entry instructions
 */
export const ROUTES = {
  /** The owners' landing — the front door, and the only page a stranger sees first. */
  home: "/",
  map: "/mapa",
  events: "/wydarzenia",
  event: (slug: string) => `/wydarzenia/${slug}`,
  bookings: "/moje-rezerwacje",
  booking: (bookingId: string) => `/rezerwacja/${bookingId}/potwierdzenie`,
  reserve: (parkingId: string, params?: { eventId?: string; hours?: number }) => {
    const query = new URLSearchParams();
    if (params?.eventId) query.set("eventId", params.eventId);
    if (params?.hours) query.set("godziny", String(params.hours));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return `/rezerwacja/${parkingId}${suffix}`;
  },
  account: "/konto",
  login: "/logowanie",
  // No `register`: signing yourself up is off (accounts are created in the admin
  // panel), and a route constant nobody may reach is a trap for the next person.
  // It comes back with the page.
  becomeHost: "/zostan-hostem",
  host: {
    dashboard: "/panel",
    parkings: "/panel/parkingi",
    bookings: "/panel/rezerwacje",
    events: "/panel/wydarzenia",
    scanner: "/panel/skaner",
    newParking: "/panel/parkingi/nowy",
    payouts: "/panel/wyplaty",
  },
  admin: {
    dashboard: "/admin",
    leads: "/admin/leady",
    clients: "/admin/klienci",
    client: (clientId: string) => `/admin/klienci/${clientId}`,
    acquisition: "/admin/akwizycja",
    mailing: "/admin/mailing",
    moderation: "/admin/moderacja",
    events: "/admin/wydarzenia",
    transactions: "/admin/transakcje",
    payouts: "/admin/wyplaty",
    commissions: "/admin/prowizje",
  },
} as const;
