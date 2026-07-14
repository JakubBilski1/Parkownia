"use client";

import type { ApiErrorBody } from "@/lib/api";

/**
 * Browser-side call into our own API. Turns the uniform error envelope
 * ({ error: { code, message } }) back into an exception whose message is
 * already the Polish sentence the user should read — forms never invent their
 * own wording for a server-side failure.
 */
export class ApiClientError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
  }
}

const NETWORK_ERROR =
  "Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie — nic nie zostało wysłane.";

async function request<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    throw new ApiClientError("NETWORK", NETWORK_ERROR);
  }

  const text = await response.text();
  const body = text ? (JSON.parse(text) as unknown) : {};

  if (!response.ok) {
    const error = (body as ApiErrorBody).error;
    throw new ApiClientError(
      error?.code ?? "INTERNAL",
      error?.message ?? "Coś po naszej stronie nie zadziałało. Spróbuj ponownie za chwilę.",
    );
  }

  return body as T;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, { method: "POST", body: JSON.stringify(body) });
}

export function getJson<T>(url: string): Promise<T> {
  return request<T>(url, { method: "GET" });
}
