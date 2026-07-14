import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminError } from "./errors";

/**
 * The error shape from docs/API_SPEC.md. Local to this module until a shared
 * src/lib/http.ts exists (integration item).
 */
export type ApiError = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
};

function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in fields)) fields[key] = issue.message;
  }
  return fields;
}

export function errorResponse(error: unknown): NextResponse<ApiError> {
  if (error instanceof AdminError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.userMessage } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "Dane w formularzu są niepoprawne. Popraw zaznaczone pola.",
          fields: zodFields(error),
        },
      },
      { status: 400 },
    );
  }

  // No payloads, no PII — only the fact that something broke (CLAUDE.md).
  console.error("[admin] unhandled error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "Operacja nie została wykonana. Nic się nie zmieniło. Spróbuj ponownie.",
      },
    },
    { status: 500 },
  );
}

/** Wraps a handler body so every admin route returns the same error contract. */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await fn());
  } catch (error) {
    return errorResponse(error);
  }
}

export function searchParamsToObject(url: string): Record<string, string | string[]> {
  const params = new URL(url).searchParams;
  const result: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    const [first] = values;
    result[key] = values.length > 1 ? values : (first ?? "");
  }
  return result;
}
