export type AdminErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "REASON_REQUIRED"
  | "AMOUNT_OUT_OF_RANGE"
  | "NOTHING_TO_REFUND"
  | "ALREADY_PAID"
  | "IN_USE"
  | "REFUND_PROVIDER_UNAVAILABLE"
  /** The host's Stripe payouts are not enabled, so their parking cannot go on sale. */
  | "PAYOUTS_NOT_ENABLED";

/**
 * Carries the HTTP status and the Polish message the operator actually reads.
 * Messages follow DESIGN_PRINCIPLES §6.10: what happened, whether it cost money,
 * what to do next — in that order.
 */
export class AdminError extends Error {
  readonly code: AdminErrorCode;
  readonly status: number;
  readonly userMessage: string;

  constructor(code: AdminErrorCode, status: number, userMessage: string) {
    super(`${code}: ${userMessage}`);
    this.name = "AdminError";
    this.code = code;
    this.status = status;
    this.userMessage = userMessage;
  }
}

export const unauthenticated = () =>
  new AdminError("UNAUTHENTICATED", 401, "Nie jesteś zalogowany. Zaloguj się kontem administratora.");

export const forbidden = () =>
  new AdminError("FORBIDDEN", 403, "To konto nie ma uprawnień administratora.");

export const notFound = (what: string) => new AdminError("NOT_FOUND", 404, `${what} nie istnieje.`);
