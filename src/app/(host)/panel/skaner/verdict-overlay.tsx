"use client";

import { Check, CloudOff, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { formatSpots, formatTimePL, formatTimeRangePL } from "@/lib/format";
import { REASON_DETAIL, REASON_HEADLINE, VERDICT_HEADLINE } from "@/modules/scan/reasons";
import type { ScanVerdict } from "@/modules/scan/types";

export type GateState =
  | { kind: "verdict"; verdict: ScanVerdict; queued: boolean }
  /** No network AND no downloaded codes: the honest answer is "I don't know". */
  | { kind: "unverifiable" };

/**
 * The whole screen is the answer. Colour, icon and word all carry it — none of
 * the three is load-bearing on its own (8% of men cannot use the colour, and
 * this is a football crowd).
 *
 * The greens and reds are the safety tokens (--scan-ok / --scan-bad), identical
 * in both themes, with white type on top: 4.9:1 and 5.9:1, i.e. AAA at this
 * type size. They are deliberately NOT the brand accent.
 */
const ADMIT_AUTO_DISMISS_MS = 2200;

export function VerdictOverlay({
  state,
  onDismiss,
}: {
  state: GateState;
  onDismiss: () => void;
}) {
  const admitted = state.kind === "verdict" && state.verdict.result === "ADMITTED";

  useEffect(() => {
    if (!admitted) return;
    const timer = setTimeout(onDismiss, ADMIT_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [admitted, onDismiss]);

  if (state.kind === "unverifiable") {
    return (
      <Shell tone="bad" onDismiss={onDismiss}>
        <CloudOff size={96} strokeWidth={2.5} aria-hidden="true" />
        <Headline>NIE MOGĘ SPRAWDZIĆ</Headline>
        <Reason>Brak sieci i brak pobranych kodów</Reason>
        <Detail>
          Nie wiem, czy ten kod jest ważny — nie zgaduję. Pobierz kody na event, gdy złapiesz sieć.
          Do tego czasu decyduj sam i spisuj kody.
        </Detail>
        <Footer>Dotknij, aby wrócić do skanowania</Footer>
      </Shell>
    );
  }

  const { verdict, queued } = state;
  const booking = verdict.booking;

  return (
    <Shell tone={admitted ? "ok" : "bad"} onDismiss={onDismiss}>
      {admitted ? (
        <Check size={112} strokeWidth={3} aria-hidden="true" />
      ) : verdict.result === "REJECTED_USED" ? (
        <ShieldAlert size={96} strokeWidth={2.5} aria-hidden="true" />
      ) : (
        <X size={112} strokeWidth={3} aria-hidden="true" />
      )}

      <Headline>{VERDICT_HEADLINE[verdict.result]}</Headline>
      <Reason>{REASON_HEADLINE[verdict.reason]}</Reason>

      {admitted && booking ? (
        <p className="num text-[1.5rem] font-semibold">
          {formatSpots(booking.spots)}
          {booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ""}
        </p>
      ) : (
        <Detail>{REASON_DETAIL[verdict.reason]}</Detail>
      )}

      {verdict.firstScanAt ? (
        <p className="text-[1.125rem] font-semibold opacity-90">
          Pierwszy wjazd o {formatTimePL(verdict.firstScanAt)}
        </p>
      ) : null}

      {booking && !admitted ? (
        <p className="num text-[1rem] opacity-90">
          Rezerwacja: {formatTimeRangePL(booking.startsAt, booking.endsAt)}
        </p>
      ) : null}

      <Footer>
        {queued ? "Zapisano offline · zsynchronizuje się samo" : null}
        {queued ? " · " : null}
        {admitted ? "Znika samo" : "Dotknij, aby skanować dalej"}
      </Footer>
    </Shell>
  );
}

function Shell({
  tone,
  onDismiss,
  children,
}: {
  tone: "ok" | "bad";
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      role="alert"
      aria-live="assertive"
      className={[
        "fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-4",
        "px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]",
        "text-center text-[#FFFFFF]",
        tone === "ok" ? "bg-scan-ok" : "bg-scan-bad",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* Signage, not UI copy: sized to be read at arm's length, in sunlight, by
   someone who is looking at a car and not at the phone. */
function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-[3rem] font-extrabold leading-none tracking-tight xs:text-[3.5rem]">
      {children}
    </h1>
  );
}

function Reason({ children }: { children: React.ReactNode }) {
  return <p className="text-[1.5rem] font-semibold leading-tight">{children}</p>;
}

function Detail({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[26rem] text-[1.0625rem] leading-snug opacity-95">{children}</p>;
}

function Footer({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-ui font-semibold uppercase tracking-wide opacity-80">{children}</p>;
}
