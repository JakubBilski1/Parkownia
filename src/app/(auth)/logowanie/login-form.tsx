"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { ApiClientError, postJson } from "@/modules/auth/api-client";
import { FormError } from "../form-error";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setPending(true);
    setError(null);

    try {
      await postJson("/api/auth/login", {
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
      });

      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się zalogować. Spróbuj ponownie.",
      );
      setPending(false);
    }
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
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="jan@przyklad.pl"
          />
        )}
      </Field>

      <Field label="Hasło" required>
        {(field) => (
          <Input
            {...field}
            name="password"
            type="password"
            autoComplete="current-password"
          />
        )}
      </Field>

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        Zaloguj się
      </Button>

      <div className="flex flex-col gap-1 text-ui text-muted">
        <Link href="/nowe-haslo" className="rounded-chip underline underline-offset-4 hover:text-ink">
          Nie pamiętam hasła
        </Link>
        <p>
          Nie masz konta?{" "}
          <Link
            href="/rejestracja"
            className="rounded-chip text-ink underline underline-offset-4"
          >
            Załóż je w minutę
          </Link>
        </p>
      </div>
    </form>
  );
}
