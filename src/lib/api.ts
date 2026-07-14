import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Single error shape for every endpoint (docs/API_SPEC.md):
 *   { "error": { "code": "SLOT_TAKEN", "message": "…po polsku, dla usera…" } }
 * `code` is for the client to branch on, `message` is what the user reads —
 * it says what happened and what to do next, and it never apologises.
 */
export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(
    code: string,
    status: number,
    message: string,
    options?: { retryAfterSeconds?: number; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export const invalidInput = (
  message = "Sprawdź poprawność wprowadzonych danych.",
  code = "VALIDATION",
): AppError => new AppError(code, 400, message);

export const unauthorized = (message = "Zaloguj się, aby kontynuować."): AppError =>
  new AppError("UNAUTHORIZED", 401, message);

export const forbidden = (
  message = "Nie masz uprawnień do tej operacji.",
): AppError => new AppError("FORBIDDEN", 403, message);

export const notFound = (message = "Nie znaleziono."): AppError =>
  new AppError("NOT_FOUND", 404, message);

export const conflict = (code: string, message: string): AppError =>
  new AppError(code, 409, message);

export const unprocessable = (code: string, message: string): AppError =>
  new AppError(code, 422, message);

export const rateLimited = (retryAfterSeconds: number): AppError =>
  new AppError(
    "RATE_LIMITED",
    429,
    `Za dużo prób. Spróbuj ponownie za ${retryAfterSeconds} s.`,
    { retryAfterSeconds },
  );

export const serviceUnavailable = (code: string, message: string): AppError =>
  new AppError(code, 503, message);

export function toErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    const headers = error.retryAfterSeconds
      ? { "Retry-After": String(error.retryAfterSeconds) }
      : undefined;

    return NextResponse.json<ApiErrorBody>(
      { error: { code: error.code, message: error.message } },
      { status: error.status, headers },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "VALIDATION",
          message: "Sprawdź poprawność wprowadzonych danych.",
        },
      },
      { status: 400 },
    );
  }

  // Never leak an internal message to the client, and never log a payload:
  // request bodies here carry e-mails, phone numbers and payment data.
  console.error("[api] unhandled error:", error instanceof Error ? error.stack : error);

  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: "INTERNAL",
        message: "Coś po naszej stronie nie zadziałało. Spróbuj ponownie za chwilę.",
      },
    },
    { status: 500 },
  );
}

export type RouteParams = Record<string, string | string[] | undefined>;

/** Shape Next.js hands a route handler as its second argument (params are async). */
export type RouteContext = {
  params: Promise<RouteParams>;
};

export type HandlerArgs<TInput> = {
  input: TInput;
  req: NextRequest;
  params: RouteParams;
};

type HandlerConfig<TInput, TOutput> = {
  /** Zod schema for the request input. Every endpoint validates on the server. */
  input?: ZodType<TInput>;
  /** Where the input comes from. Defaults to query for GET/DELETE, body otherwise. */
  source?: "body" | "query";
  handle: (args: HandlerArgs<TInput>) => Promise<TOutput | Response>;
};

async function readInput(req: NextRequest, source: "body" | "query"): Promise<unknown> {
  if (source === "query") {
    const query: Record<string, string> = {};
    req.nextUrl.searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return query;
  }

  const raw = await req.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw invalidInput("Nie udało się odczytać danych żądania.");
  }
}

/**
 * Wraps a route handler: parses and validates input with Zod, then maps thrown
 * AppErrors onto HTTP codes (400/401/403/404/409/422/429/503). A handler that
 * needs a non-200 status returns a Response itself (see `created`).
 */
export function handler<TInput = undefined, TOutput = unknown>(
  config: HandlerConfig<TInput, TOutput>,
) {
  return async (req: NextRequest, context: RouteContext): Promise<Response> => {
    try {
      // Typed as required because Next's route validator demands that exact
      // signature; guarded anyway, because unit tests call handlers directly.
      const params: RouteParams = (await context?.params) ?? {};

      let input = undefined as TInput;
      if (config.input) {
        const source =
          config.source ?? (req.method === "GET" || req.method === "DELETE" ? "query" : "body");
        input = config.input.parse(await readInput(req, source));
      }

      const result = await config.handle({ input, req, params });
      if (result instanceof Response) return result;

      return NextResponse.json(result ?? { ok: true });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function created<T>(body: T): NextResponse<T> {
  return NextResponse.json(body, { status: 201 });
}
