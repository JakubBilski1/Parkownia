"use client";

import { useEffect } from "react";

/**
 * The last boundary. `error.tsx` catches what breaks inside a page; anything
 * that breaks in the root layout — or, far more often, a chunk that stopped
 * existing — escapes past it, and Next then paints its own bare English line:
 * "Application error: a client-side exception has occurred". That is what a
 * user sees in a tab they opened before a deploy and clicked after it.
 *
 * So the answer here is a reload, not `reset()`. Retrying the render fetches
 * the same missing chunk again; a full load fetches the build that actually
 * exists now. Styles are inline on purpose: whatever failed may have taken the
 * stylesheet with it, and this screen still has to be readable.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Global render error", error.digest ?? "(brak identyfikatora)");
  }, [error]);

  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1a1918",
          color: "#f1ede7",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, lineHeight: 1.15 }}>
            Ta strona się nie wczytała
          </h1>
          <p style={{ marginTop: "12px", lineHeight: 1.6, color: "#9e978d" }}>
            Najczęściej znaczy to, że wypuściliśmy nową wersję, gdy miałeś otwartą starą.
            Przeładowanie pobierze aktualną. Nic nie zostało wysłane ani pobrane z Twojego konta.
          </p>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "20px",
              minHeight: "44px",
              padding: "0 18px",
              borderRadius: "10px",
              border: "none",
              background: "#c93a3a",
              color: "#fff7f5",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Przeładuj stronę
          </button>

          {error.digest ? (
            <p style={{ marginTop: "16px", fontSize: "0.875rem", color: "#9e978d" }}>
              Identyfikator błędu: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
