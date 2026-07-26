"use client";

/**
 * What the message will look like in an inbox.
 *
 * An APPROXIMATION, and deliberately labelled as one on the screen: the real HTML
 * is rendered by the mail service from docs/mail-templates/owner-campaign.mjml.
 * This mirrors that file's structure and colours (light theme, stamp red accent)
 * so the operator can judge length, tone and line breaks before sending — which is
 * what a preview is for. If you change one, change the other.
 *
 * The colours are hard-coded rather than taken from the theme tokens on purpose:
 * an e-mail is always light. Rendering the preview in the dark theme would show
 * the operator something no recipient will ever see.
 */
export function CampaignPreview({
  subject,
  preheader,
  heading,
  paragraphs,
  ctaLabel,
  ctaUrl,
  recipientName,
}: {
  subject: string;
  preheader: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string | undefined;
  ctaUrl?: string | undefined;
  recipientName?: string | null;
}) {
  const hasCta = Boolean(ctaLabel && ctaUrl);
  const greeting = recipientName ? `Dzień dobry, ${recipientName}` : "Dzień dobry";

  return (
    <div className="flex flex-col gap-2">
      {/* The inbox line: subject and preheader are read before anything else. */}
      <div className="rounded-card border border-line bg-surface-2 p-3">
        <p className="text-ui font-semibold text-ink">
          {subject || <span className="text-muted">(bez tematu)</span>}
        </p>
        <p className="line-clamp-1 text-ui text-muted">
          {preheader || paragraphs[0] || "—"}
        </p>
      </div>

      <div
        className="overflow-hidden rounded-card border border-line"
        style={{ backgroundColor: "#eeeeeb" }}
      >
        <div style={{ padding: "24px 20px 10px" }}>
          <p
            style={{
              margin: 0,
              color: "#1a1918",
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            }}
          >
            Parkownia
          </p>
        </div>

        <div
          style={{
            margin: "0 20px",
            padding: "26px 22px",
            backgroundColor: "#ffffff",
            borderRadius: 12,
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <p
            style={{
              margin: "0 0 14px",
              color: "#1a1918",
              fontSize: 22,
              lineHeight: 1.25,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            {heading || "Nagłówek wiadomości"}
          </p>

          <p style={{ margin: "0 0 12px", color: "#6b6862", fontSize: 15, lineHeight: 1.6 }}>
            {greeting},
          </p>

          {paragraphs.length === 0 ? (
            <p style={{ margin: 0, color: "#6b6862", fontSize: 15, lineHeight: 1.6 }}>
              Tu pojawi się treść, którą napiszesz obok.
            </p>
          ) : (
            paragraphs.map((paragraph, index) => (
              <p
                key={index}
                style={{ margin: "0 0 13px", color: "#1a1918", fontSize: 15, lineHeight: 1.6 }}
              >
                {paragraph}
              </p>
            ))
          )}

          {hasCta ? (
            <div style={{ paddingTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  backgroundColor: "#8e2b2b",
                  color: "#f7f6f3",
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "13px 22px",
                  borderRadius: 10,
                }}
              >
                {ctaLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div style={{ padding: "16px 22px 24px" }}>
          <div style={{ borderTop: "1px solid #dedbd4", paddingTop: 12 }}>
            <p style={{ margin: "0 0 8px", color: "#6b6862", fontSize: 12.5, lineHeight: 1.6 }}>
              Piszemy do właścicieli miejsc parkingowych w Poznaniu.{" "}
              <span style={{ textDecoration: "underline" }}>Nie chcę takich wiadomości</span> —
              odpowiedz, a skreślimy Cię z listy.
            </p>
            <p style={{ margin: 0, color: "#6b6862", fontSize: 12.5, lineHeight: 1.6 }}>
              Administrator danych: Jakub Bilski, ul. Krótka 10a, Mosina. Kontakt:
              kontakt@parkownia.com.
            </p>
          </div>
        </div>
      </div>

      <p className="text-ui text-muted">
        Podglądowa rekonstrukcja. Ostateczny HTML składa serwer pocztowy z szablonu
        <code className="mx-1 rounded bg-surface-2 px-1 font-mono">owner-campaign</code>
        (źródło: <code className="font-mono">docs/mail-templates/owner-campaign.mjml</code>).
      </p>
    </div>
  );
}
