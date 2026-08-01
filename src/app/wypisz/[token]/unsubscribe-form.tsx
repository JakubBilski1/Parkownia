"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

type UnsubscribeFormProps = { token: string };

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; alreadyOff: boolean }
  | { kind: "error"; message: string };

/**
 * One button. Somebody who got here wants out, and every extra step between them
 * and that is a step towards a spam complaint instead.
 */
export function UnsubscribeForm({ token }: UnsubscribeFormProps) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit() {
    setState({ kind: "sending" });
    try {
      const response = await fetch(`/api/wypisz/${encodeURIComponent(token)}`, {
        method: "POST",
      });

      if (!response.ok) {
        setState({
          kind: "error",
          message:
            response.status === 404
              ? "Nie rozpoznajemy tego linku. Napisz na kontakt@parkownia.com, a wypiszemy Cię ręcznie."
              : "Nie udało się zapisać. Spróbuj jeszcze raz albo napisz na kontakt@parkownia.com.",
        });
        return;
      }

      const payload = (await response.json().catch(() => ({}))) as { alreadyOff?: boolean };
      setState({ kind: "done", alreadyOff: payload.alreadyOff === true });
    } catch {
      setState({
        kind: "error",
        message: "Brak połączenia. Nic nie zostało zapisane — sprawdź internet i kliknij ponownie.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="flex flex-col items-start gap-2">
        <Check size={28} aria-hidden="true" className="text-accent" />
        <h2 className="font-display text-h2 font-bold text-ink">
          {state.alreadyOff ? "Już Cię nie ma na liście" : "Wypisane"}
        </h2>
        <p className="text-body text-ink">
          Nie napiszemy do Ciebie ponownie. Nie musisz nic więcej robić.
        </p>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {state.kind === "error" ? (
        <p
          role="alert"
          className="rounded-card border border-danger bg-danger-soft p-3 text-body text-ink"
        >
          {state.message}
        </p>
      ) : null}

      <Button
        variant="accent"
        size="lg"
        block
        loading={state.kind === "sending"}
        disabled={state.kind === "sending"}
        onClick={submit}
      >
        Wypisz mnie
      </Button>
    </div>
  );
}
