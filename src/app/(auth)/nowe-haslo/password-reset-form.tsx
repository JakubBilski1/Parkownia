"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { ApiClientError, postJson } from "@/modules/auth/api-client";
import { PASSWORD_MIN_LENGTH } from "@/modules/auth/policy";
import { FormError } from "../form-error";

/** No token in the link: ask where to send one. */
export function PasswordResetRequestForm() {
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);

    try {
      await postJson("/api/auth/password-reset", {
        email: String(form.get("email") ?? ""),
      });
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się wysłać linku. Spróbuj ponownie.",
      );
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-card border border-line bg-surface p-4 text-body text-ink">
          Jeśli mamy konto z tym adresem, link do ustawienia hasła jest już w drodze. Ważny
          przez godzinę.
        </p>
        <Link
          href="/logowanie"
          className="rounded-chip text-ui text-ink underline underline-offset-4"
        >
          Wróć do logowania
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />

      <Field label="E-mail" required>
        {(field) => (
          <Input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="jan@przyklad.pl"
          />
        )}
      </Field>

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        Wyślij link
      </Button>
    </form>
  );
}

/** Token in the link: set the new password. */
export function PasswordResetConfirmForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < PASSWORD_MIN_LENGTH) return;

    setPending(true);
    setError(null);

    try {
      await postJson("/api/auth/password-reset/confirm", { token, password });
      router.replace("/logowanie");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się ustawić hasła. Poproś o nowy link.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />

      <Field
        label="Nowe hasło"
        required
        hint={`Minimum ${PASSWORD_MIN_LENGTH} znaków.`}
        error={tooShort ? `Jeszcze ${PASSWORD_MIN_LENGTH - password.length} znaków.` : undefined}
      >
        {(field) => (
          <Input
            {...field}
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <p className="text-ui text-muted">
        Ustawienie hasła wylogowuje wszystkie urządzenia, na których to konto było zalogowane.
      </p>

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        Ustaw hasło
      </Button>
    </form>
  );
}
