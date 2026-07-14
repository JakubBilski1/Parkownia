"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Checkbox, Field, Input } from "@/components/ui";
import { ApiClientError, postJson } from "@/modules/auth/api-client";
import { PASSWORD_MIN_LENGTH } from "@/modules/auth/policy";
import { FormError } from "../form-error";

type FieldErrors = {
  email?: string;
  password?: string;
  consents?: string;
};

export function RegisterForm({ next }: { next: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);

  // The rule is stated before it is broken, and the error only appears once the
  // user has actually typed something short.
  const passwordTooShort = password.length > 0 && password.length < PASSWORD_MIN_LENGTH;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    const email = String(form.get("email") ?? "").trim();
    const next_: FieldErrors = {};

    if (!email.includes("@")) next_.email = "Podaj poprawny adres e-mail.";
    if (password.length < PASSWORD_MIN_LENGTH) {
      next_.password = `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`;
    }
    if (!terms || !privacy) {
      next_.consents = "Bez tych dwóch zgód nie możemy założyć konta.";
    }

    setFieldErrors(next_);
    if (Object.keys(next_).length > 0) return;

    setPending(true);
    setError(null);

    try {
      await postJson("/api/auth/register", {
        email,
        password,
        firstName: String(form.get("firstName") ?? "").trim() || undefined,
        consents: {
          terms: true,
          privacy: true,
          marketingEmail: form.get("marketingEmail") === "on",
        },
      });

      router.replace(next);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiClientError
          ? cause.message
          : "Nie udało się założyć konta. Spróbuj ponownie.",
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormError message={error} />

      <Field label="E-mail" required error={fieldErrors.email}>
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

      <Field
        label="Hasło"
        required
        hint={`Minimum ${PASSWORD_MIN_LENGTH} znaków.`}
        error={
          fieldErrors.password ??
          (passwordTooShort
            ? `Jeszcze ${PASSWORD_MIN_LENGTH - password.length} znaków.`
            : undefined)
        }
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

      <Field label="Imię">
        {(field) => (
          <Input {...field} name="firstName" autoComplete="given-name" placeholder="Jan" />
        )}
      </Field>

      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-3">
        <Checkbox
          name="terms"
          checked={terms}
          onChange={(event) => setTerms(event.target.checked)}
          label={
            <span>
              Akceptuję{" "}
              <Link href="/regulamin" className="underline underline-offset-4">
                regulamin
              </Link>
              .
            </span>
          }
        />
        <Checkbox
          name="privacy"
          checked={privacy}
          onChange={(event) => setPrivacy(event.target.checked)}
          label={
            <span>
              Zgadzam się na przetwarzanie moich danych zgodnie z{" "}
              <Link href="/prywatnosc" className="underline underline-offset-4">
                polityką prywatności
              </Link>
              .
            </span>
          }
        />
        <Checkbox
          name="marketingEmail"
          label="Chcę dostawać e-maile o wydarzeniach i parkingach w mojej okolicy."
          hint="Możesz to wyłączyć w każdej chwili."
        />

        {fieldErrors.consents ? (
          <p role="alert" className="text-ui text-danger">
            {fieldErrors.consents}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="accent" size="lg" block loading={pending}>
        Załóż konto
      </Button>

      <p className="text-ui text-muted">
        Masz już konto?{" "}
        <Link href="/logowanie" className="rounded-chip text-ink underline underline-offset-4">
          Zaloguj się
        </Link>
      </p>
    </form>
  );
}
