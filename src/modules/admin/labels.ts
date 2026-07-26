/** Polish labels for database enums. The UI never shows an enum name (DESIGN_PRINCIPLES §6.2). */

export const PARKING_STATUS_LABEL = {
  DRAFT: "Szkic",
  PENDING_REVIEW: "Czeka na moderację",
  ACTIVE: "Aktywny",
  PAUSED: "Wstrzymany",
  REJECTED: "Odrzucony",
} as const;

export const BOOKING_STATUS_LABEL = {
  PENDING: "Nieopłacona",
  CONFIRMED: "Opłacona",
  CANCELLED: "Anulowana",
  EXPIRED: "Wygasła",
  USED: "Wykorzystana",
  NO_SHOW: "Nie dojechał",
} as const;

export const PAYMENT_STATUS_LABEL = {
  INITIATED: "Rozpoczęta",
  PROCESSING: "W trakcie",
  SUCCEEDED: "Zapłacona",
  FAILED: "Nieudana",
  REFUNDED: "Zwrócona",
  PARTIALLY_REFUNDED: "Zwrócona częściowo",
} as const;

export const PAYOUT_STATUS_LABEL = {
  PENDING: "Do wypłaty",
  PAID: "Wypłacona",
  FAILED: "Nieudana",
} as const;

export const OWNER_TYPE_LABEL = {
  INDIVIDUAL: "Osoba prywatna",
  BUSINESS: "Firma",
} as const;

export const PARKING_TYPE_LABEL = {
  OUTDOOR_LOT: "Plac zewnętrzny",
  UNDERGROUND: "Podziemny",
  GARAGE: "Garaż",
  DRIVEWAY: "Podjazd",
  STREET_ADJACENT: "Przy ulicy",
  MULTI_STOREY: "Wielopoziomowy",
} as const;

export const ACCESS_TYPE_LABEL = {
  OPEN: "Otwarty",
  BARRIER_CODE: "Szlaban na kod",
  BARRIER_REMOTE: "Szlaban na pilota",
  GATE_MANUAL: "Brama otwierana ręcznie",
  LPR: "Rozpoznawanie tablic",
  KEY_HANDOVER: "Przekazanie klucza",
  ATTENDANT: "Obsługa na miejscu",
} as const;

export const EVENT_CATEGORY_LABEL = {
  FOOTBALL: "Mecz",
  CONCERT: "Koncert",
  TRADE_FAIR: "Targi",
  SPORTS: "Sport",
  FESTIVAL: "Festiwal",
  OTHER: "Inne",
} as const;

export const COMMISSION_SCOPE_LABEL = {
  GLOBAL_INDIVIDUAL: "Globalna — osoby prywatne",
  GLOBAL_BUSINESS: "Globalna — firmy",
  USER: "Host",
  PARKING: "Parking",
} as const;

export const LEAD_STATUS_LABEL = {
  NEW: "Nowy",
  CONTACTED: "Skontaktowany",
  QUALIFIED: "Rokuje",
  CONVERTED: "Wystawił parking",
  REJECTED: "Odpadł",
  SPAM: "Spam",
} as const;

export const LEAD_OBJECT_TYPE_LABEL = {
  LOT: "Plac / parking otwarty",
  DRIVEWAY: "Podjazd / miejsce przy domu",
  COMPANY_LOT: "Parking firmowy",
  GARAGE: "Garaż / parking podziemny",
  OTHER: "Inne",
} as const;

export const LEAD_CONTACT_PREFERENCE_LABEL = {
  PHONE: "Woli telefon",
  EMAIL: "Woli e-mail",
} as const;
