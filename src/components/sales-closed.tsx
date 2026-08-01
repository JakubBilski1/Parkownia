"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

type SalesClosedProps = {
  /** What they were looking at, so the signal says which venue to work next. */
  parkingId?: string;
  eventId?: string;
  source: string;
  /** The sheet on the map is cramped; the checkout page has room for a heading. */
  variant?: "compact" | "full";
};

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done" }
  | { kind: "error"; message: string };

/**
 * What a driver meets where the checkout used to be, while no PSP is configured.
 *
 * The alternative — the state this replaces — was a working-looking form that
 * took an e-mail, a phone number and two consents, created a booking, and then
 * sat on "Czekamy na płatność" forever, because the mock provider refuses to
 * confirm anything in production. Taking somebody's details and giving nothing
 * back is worse than saying "not yet". This says "not yet", asks for one field
 * instead of four, and is honest about what happens next.
 */
export function SalesClosed({ parkingId, eventId, source, variant = "full" }: SalesClosedProps) {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;

    setState({ kind: "sending" });
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), parkingId, eventId, source, website }),
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            response.status === 429
              ? "Chwilę za szybko. Spróbuj ponownie za minutę."
              : "Nie udało się zapisać. Napisz na kontakt@parkownia.com, a dopiszemy Cię ręcznie.",
        });
        return;
      }

      setState({ kind: "done" });
    } catch {
      setState({
        kind: "error",
        message: "Brak połączenia. Nic nie zostało zapisane — sprawdź internet i spróbuj ponownie.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="flex flex-col items-start gap-2 rounded-card border border-line bg-surface-2 p-4">
        <Check size={24} aria-hidden="true" className="text-accent" />
        <p className="text-body font-semibold text-ink">Zapisane</p>
        <p className="text-ui text-muted">
          Odezwiemy się, zanim uruchomimy rezerwacje. Nie wysyłamy nic poza tym.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-card border border-line bg-surface-2 p-4"
    >
      {variant === "full" ? (
        <h2 className="font-display text-h3 font-bold text-ink">
          Jeszcze nie sprzedajemy online
        </h2>
      ) : (
        <p className="text-body font-semibold text-ink">Jeszcze nie sprzedajemy online</p>
      )}

      <p className="text-ui text-muted">
        Uruchamiamy rezerwacje pod najbliższe mecze i targi. Zostaw adres — damy znać, zanim
        ruszymy, i będziesz pierwszy w kolejce.
      </p>

      {state.kind === "error" ? (
        <p role="alert" className="rounded-card border border-danger bg-danger-soft p-3 text-ui text-ink">
          {state.message}
        </p>
      ) : null}

      {/* Honeypot: off-screen rather than display:none, which some bots skip. */}
      <label className="sr-only" aria-hidden="true">
        Nie wypełniaj tego pola
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          inputMode="email"
          autoComplete="email"
          placeholder="jan@example.com"
          aria-label="Twój e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-touch w-full rounded-card border border-line bg-surface px-3 text-body text-ink placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        />
        <Button
          type="submit"
          variant="accent"
          size="lg"
          loading={state.kind === "sending"}
          disabled={state.kind === "sending"}
        >
          Powiadom mnie
        </Button>
      </div>

      <p className="text-ui text-muted">
        Adres używamy wyłącznie do tej jednej wiadomości.
      </p>
    </form>
  );
}
