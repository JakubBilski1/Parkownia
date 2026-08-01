import { AppError } from "@/lib/api";

export type DomainErrorCode =
  | "VALIDATION_FAILED"
  | "PARKING_NOT_FOUND"
  | "PARKING_NOT_BOOKABLE"
  | "EVENT_NOT_FOUND"
  | "NOT_AVAILABLE_IN_WINDOW"
  | "PRICE_UNAVAILABLE"
  | "MIN_DURATION"
  | "WINDOW_IN_PAST"
  | "SLOT_TAKEN"
  | "BOOKING_NOT_FOUND"
  | "BOOKING_EXPIRED"
  | "BOOKING_NOT_PENDING"
  | "BOOKING_NOT_CANCELLABLE"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_PROVIDER_DOWN"
  | "SALES_CLOSED"
  | "HOST_CANNOT_BE_PAID"
  | "FORBIDDEN"
  | "UNAUTHORIZED"
  | "RATE_LIMITED";

const STATUS: Record<DomainErrorCode, number> = {
  VALIDATION_FAILED: 400,
  PARKING_NOT_FOUND: 404,
  PARKING_NOT_BOOKABLE: 422,
  EVENT_NOT_FOUND: 404,
  NOT_AVAILABLE_IN_WINDOW: 422,
  PRICE_UNAVAILABLE: 422,
  MIN_DURATION: 422,
  WINDOW_IN_PAST: 422,
  SLOT_TAKEN: 409,
  BOOKING_NOT_FOUND: 404,
  BOOKING_EXPIRED: 410,
  BOOKING_NOT_PENDING: 422,
  BOOKING_NOT_CANCELLABLE: 422,
  PAYMENT_NOT_FOUND: 404,
  PAYMENT_PROVIDER_DOWN: 503,
  SALES_CLOSED: 503,
  HOST_CANNOT_BE_PAID: 422,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
};

/**
 * Messages are the ones the driver reads. Per DESIGN_PRINCIPLES §6.10 every
 * money-adjacent message says what happened, whether it cost money, and what to
 * do next — in that order.
 */
const MESSAGE: Record<DomainErrorCode, string> = {
  VALIDATION_FAILED: "Dane są niepoprawne. Popraw zaznaczone pola i spróbuj ponownie.",
  PARKING_NOT_FOUND: "Nie znaleźliśmy tego parkingu.",
  PARKING_NOT_BOOKABLE: "Ten parking nie przyjmuje teraz rezerwacji.",
  EVENT_NOT_FOUND: "Nie znaleźliśmy tego wydarzenia.",
  NOT_AVAILABLE_IN_WINDOW: "Ten parking nie jest dostępny w wybranym terminie.",
  PRICE_UNAVAILABLE: "Ten parking nie ma ceny na wybrany termin. Wybierz inny parking.",
  MIN_DURATION: "Rezerwacja jest krótsza niż minimalny czas dla tego parkingu.",
  WINDOW_IN_PAST: "Nie da się zarezerwować miejsca w przeszłości.",
  SLOT_TAKEN: "Ostatnie miejsce właśnie zostało zajęte. Nie pobraliśmy pieniędzy. Wybierz inny parking.",
  BOOKING_NOT_FOUND: "Nie znaleźliśmy tej rezerwacji.",
  BOOKING_EXPIRED:
    "Rezerwacja wygasła — mieliśmy ją tylko przez 15 minut. Nie pobraliśmy pieniędzy. Zarezerwuj miejsce jeszcze raz.",
  BOOKING_NOT_PENDING: "Ta rezerwacja jest już rozliczona.",
  BOOKING_NOT_CANCELLABLE: "Tej rezerwacji nie da się już anulować.",
  PAYMENT_NOT_FOUND: "Nie znaleźliśmy płatności dla tej rezerwacji.",
  PAYMENT_PROVIDER_DOWN:
    "Operator płatności nie odpowiada. Środki nie zostały pobrane. Spróbuj ponownie za chwilę.",
  // Not "try again in a moment" — trying again will not help until somebody
  // configures a PSP, and saying otherwise sends people round a loop.
  SALES_CLOSED:
    "Nie uruchomiliśmy jeszcze rezerwacji online. Nic nie zostało zamówione ani opłacone. Zostaw adres na stronie parkingu, a damy znać, gdy ruszymy.",
  HOST_CANNOT_BE_PAID: "Ten parking nie przyjmuje teraz płatności. Wybierz inny.",
  FORBIDDEN: "Nie masz dostępu do tej rezerwacji.",
  UNAUTHORIZED: "Zaloguj się, aby zobaczyć swoje rezerwacje.",
  RATE_LIMITED: "Za dużo prób. Odczekaj minutę i spróbuj ponownie.",
};

/**
 * Extends the shared AppError so that a DomainError thrown out of these services
 * is mapped correctly by ANY route in the app — including the admin and host
 * routes owned by other modules, which funnel everything through
 * lib/api.toErrorResponse(). Without that inheritance, "SLOT_TAKEN" would reach
 * an admin endpoint as a 500.
 */
export class DomainError extends AppError {
  readonly domainCode: DomainErrorCode;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, options?: { message?: string; details?: unknown }) {
    super(code, STATUS[code], options?.message ?? MESSAGE[code]);
    this.name = "DomainError";
    this.domainCode = code;
    this.details = options?.details;
  }
}

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

/**
 * Same JSON shape as lib/api.toErrorResponse (docs/API_SPEC.md), plus the field
 * errors the checkout form needs to mark inputs.
 *
 * Why these routes do not simply call toErrorResponse: its generic 500 says
 * "spróbuj ponownie za chwilę". On a money path that sentence can cost the
 * driver 35 zł twice. An unknown failure here has to admit that we do not know
 * whether the payment went through, and send them to look before they pay again
 * (DESIGN_PRINCIPLES §6.10).
 */
export function toApiError(error: unknown): {
  status: number;
  body: ApiErrorBody;
  headers?: Record<string, string>;
} {
  if (error instanceof AppError) {
    const details = error instanceof DomainError ? error.details : undefined;
    return {
      status: error.status,
      body: {
        error: { code: error.code, message: error.message, ...(details ? { details } : {}) },
      },
      ...(error.retryAfterSeconds
        ? { headers: { "Retry-After": String(error.retryAfterSeconds) } }
        : {}),
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message:
          "Coś padło po naszej stronie. Jeśli płaciłeś — sprawdź swoje rezerwacje, zanim zapłacisz ponownie.",
      },
    },
  };
}
