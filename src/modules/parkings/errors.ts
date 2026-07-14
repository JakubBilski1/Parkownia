import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "UNPROCESSABLE"
  | "RATE_LIMITED"
  | "UPSTREAM_UNAVAILABLE";

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
};

export type ErrorDetail = { field: string; message: string };

/**
 * The message is what the driver reads, so it is Polish, active voice, and says
 * what happened rather than apologising (docs/DESIGN_PRINCIPLES.md §6.10).
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details: ErrorDetail[] | undefined;

  constructor(code: ApiErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }

  get status(): number {
    return STATUS[this.code];
  }
}

export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join(".") || "_",
    message: issue.message,
  }));
}

export function badRequest(error: ZodError): ApiError {
  return new ApiError("VALIDATION", "Formularz zawiera błędy.", zodDetails(error));
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  // Never leak an internal message to the client, and never log a payload that
  // could carry personal data — only the shape of the failure.
  console.error("[parkings] unhandled error:", error instanceof Error ? error.name : "unknown");

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "Nie udało się wykonać operacji. Spróbuj ponownie za chwilę.",
      },
    },
    { status: 500 },
  );
}
