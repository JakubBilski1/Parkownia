import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Rejestracja",
};

function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function RegisterPage({
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
          Załóż konto
        </h1>
        <p className="text-body text-muted">
          Konto trzyma Twoje rezerwacje i kody wjazdu w jednym miejscu. Miejsce parkingowe
          kupisz też bez niego — konto założy się przy płatności.
        </p>
      </div>

      <RegisterForm next={next} />
    </div>
  );
}
