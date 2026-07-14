export type ApiError = { code: string; message: string };

/**
 * Every endpoint answers with { error: { code, message } } (docs/API_SPEC.md) and
 * the message is already written for the user, in Polish. So the client shows it
 * verbatim instead of inventing a second, worse sentence — and only falls back
 * when the request never reached an endpoint at all (offline, 502).
 */
export async function readApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    const error = (body as { error?: { code?: unknown; message?: unknown } }).error;

    if (error && typeof error.message === "string") {
      return {
        code: typeof error.code === "string" ? error.code : "UNKNOWN",
        message: error.message,
      };
    }
  } catch {
    // Not JSON — fall through to the transport-level message.
  }

  return {
    code: "UNKNOWN",
    message: "Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.",
  };
}

export const NETWORK_ERROR: ApiError = {
  code: "NETWORK",
  message: "Nie udało się połączyć z serwerem. Sprawdź internet i spróbuj ponownie.",
};
