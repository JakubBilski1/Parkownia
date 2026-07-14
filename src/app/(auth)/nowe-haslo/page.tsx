import type { Metadata } from "next";
import {
  PasswordResetConfirmForm,
  PasswordResetRequestForm,
} from "./password-reset-form";

export const metadata: Metadata = {
  title: "Nowe hasło",
};

/**
 * One page, two states: without a token it asks where to send the link, with a
 * token it sets the password. Same destination in the mail, same URL in the
 * browser history — the user never has to work out which page they are on.
 */
export default async function NewPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = Array.isArray(raw) ? raw[0] : raw;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          {token ? "Ustaw nowe hasło" : "Nie pamiętasz hasła?"}
        </h1>
        <p className="text-body text-muted">
          {token
            ? "Wpisz hasło, którym będziesz się logować."
            : "Podaj adres e-mail. Wyślemy link do ustawienia nowego hasła."}
        </p>
      </div>

      {token ? <PasswordResetConfirmForm token={token} /> : <PasswordResetRequestForm />}
    </div>
  );
}
