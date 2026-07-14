import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";
import { pl } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIME_ZONE } from "@/lib/format";

/**
 * Email clients do not resolve CSS custom properties, so the light ("Bilet") tokens
 * from src/app/globals.css are repeated here as literals. Dark mode is not attempted:
 * inbox clients invert colours on their own and a second palette would fight them.
 */
export const token = {
  bg: "#EEEEEB",
  surface: "#FFFFFF",
  surface2: "#F3F3F0",
  ink: "#191A1C",
  muted: "#70747A",
  line: "#DEDEDA",
  accent: "#8E2B2B",
  accentInk: "#FFFFFF",
  ok: "#0F7B4F",
  danger: "#B3261E",
} as const;

const display = "Archivo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const body = "'IBM Plex Sans', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const mono = "'IBM Plex Mono', ui-monospace, SFMono-Regular, Consolas, monospace";

export const font = { display, body, mono } as const;

const bodyStyle: CSSProperties = {
  backgroundColor: token.bg,
  color: token.ink,
  fontFamily: body,
  fontSize: "16px",
  lineHeight: "24px",
  margin: 0,
  padding: "24px 12px",
};

const containerStyle: CSSProperties = {
  backgroundColor: token.surface,
  border: `1px solid ${token.line}`,
  borderRadius: "14px",
  margin: "0 auto",
  maxWidth: "560px",
  padding: "32px 28px",
};

const wordmarkStyle: CSSProperties = {
  color: token.ink,
  fontFamily: display,
  fontSize: "18px",
  fontWeight: 800,
  letterSpacing: "-0.01em",
  margin: "0 0 24px",
};

const headingStyle: CSSProperties = {
  color: token.ink,
  fontFamily: display,
  fontSize: "28px",
  fontWeight: 700,
  lineHeight: "34px",
  letterSpacing: "-0.02em",
  margin: "0 0 16px",
};

export const textStyle: CSSProperties = {
  color: token.ink,
  fontFamily: body,
  fontSize: "16px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

export const mutedStyle: CSSProperties = {
  color: token.muted,
  fontFamily: body,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 8px",
};

const hrStyle: CSSProperties = {
  border: "none",
  borderTop: `1px solid ${token.line}`,
  margin: "28px 0 20px",
};

const footerStyle: CSSProperties = {
  color: token.muted,
  fontFamily: body,
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 6px",
};

/**
 * "sobotę, 25 lipca" — the accusative that follows "w". date-fns gives the
 * nominative ("sobota"), which reads broken in the one sentence that has to sell
 * a host on opening his gate.
 */
const WEEKDAY_ACCUSATIVE: Record<string, string> = {
  "1": "poniedziałek",
  "2": "wtorek",
  "3": "środę",
  "4": "czwartek",
  "5": "piątek",
  "6": "sobotę",
  "7": "niedzielę",
};

export function formatEventDayPL(value: string): string {
  const date = new Date(value);
  const isoDay = formatInTimeZone(date, APP_TIME_ZONE, "i");
  const dayMonth = formatInTimeZone(date, APP_TIME_ZONE, "d MMMM", { locale: pl });
  return `${WEEKDAY_ACCUSATIVE[isoDay] ?? ""}, ${dayMonth}`.replace(/^, /, "");
}

/** Polish plural: 1 miejsce · 2–4 miejsca · 5+ miejsc (and 12–14 back to "miejsc"). */
export function formatSpots(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  if (count === 1) return "1 miejsce";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${count} miejsca`;
  return `${count} miejsc`;
}

export function appUrl(path = ""): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://parkspot.pl";
  return `${base.replace(/\/$/, "")}${path}`;
}

type LayoutProps = {
  preview: string;
  heading: string;
  children: ReactNode;
  /** Why this person is getting this email. One sentence, no marketing. */
  footerNote: string;
};

export function Layout({ preview, heading, children, footerNote }: LayoutProps) {
  return (
    <Html lang="pl" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          <Text style={wordmarkStyle}>ParkSpot</Text>
          <Heading as="h1" style={headingStyle}>
            {heading}
          </Heading>
          {children}
          <Hr style={hrStyle} />
          <Text style={footerStyle}>{footerNote}</Text>
          {/* Points at /konto, where the consent panel actually lives. It used to
              point at /konto/powiadomienia, which has never existed — a 404 in the
              footer of every transactional e-mail, including the one that is
              supposed to let a recipient turn marketing off.
              The "Pomoc" link is gone until /pomoc exists: a dead help link on the
              e-mail a driver opens when something has already gone wrong is worse
              than no link at all. */}
          <Text style={footerStyle}>
            <Link href={appUrl("/konto")} style={{ color: token.muted }}>
              Ustawienia powiadomień
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/* -------------------------------------------------------------------------- */
/* Building blocks                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The one accented element per email. Rendered as a table so Outlook honours the
 * background; a plain <a> loses it. No gradient, no hover trickery.
 */
export function Cta({ href, label }: { href: string; label: string }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0 24px" }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: token.accent,
              borderRadius: "12px",
            }}
          >
            <Link
              href={href}
              style={{
                color: token.accentInk,
                display: "inline-block",
                fontFamily: body,
                fontSize: "16px",
                fontWeight: 600,
                lineHeight: "24px",
                padding: "12px 24px",
                textDecoration: "none",
              }}
            >
              {label}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function SecondaryLink({ href, label }: { href: string; label: string }) {
  return (
    <Text style={{ ...textStyle, margin: "0 0 20px" }}>
      <Link href={href} style={{ color: token.ink, textDecoration: "underline" }}>
        {label}
      </Link>
    </Text>
  );
}

/** Label above value — reads the same with CSS stripped, because it is two lines. */
export function DetailRow({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: string;
  monospace?: boolean;
}) {
  return (
    <Section style={{ margin: "0 0 14px" }}>
      <Text style={{ ...mutedStyle, margin: "0 0 2px" }}>{label}</Text>
      <Text
        style={{
          ...textStyle,
          fontFamily: monospace ? mono : body,
          fontVariantNumeric: "tabular-nums",
          margin: 0,
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: token.surface2,
        border: `1px solid ${token.line}`,
        borderRadius: "14px",
        margin: "0 0 24px",
        padding: "20px",
      }}
    >
      {children}
    </Section>
  );
}
