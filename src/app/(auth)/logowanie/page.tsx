import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Logowanie",
};

/** Only paths inside this app — a `next` from the query string is user input. */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);

  if (await getSession()) {
    redirect(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          Zaloguj się
        </h1>
        <p className="text-body text-muted">
          Twoje rezerwacje i kody wjazdu są tutaj.
        </p>
      </div>

      <LoginForm next={next} />
    </div>
  );
}
