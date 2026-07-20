import { buttonVariants } from "@/components/ui";

export function Hero() {
  return (
    <section className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <p className="text-ui font-semibold uppercase tracking-wide text-muted">
          Dla właścicieli miejsc
        </p>
        {/* Marketing hero size only — the app's 6-level scale tops out at h1 (36px);
            a responsive clamp keeps that scale intact (DESIGN_PRINCIPLES §3). */}
        <h1 className="mt-3 max-w-3xl font-display text-[clamp(2.5rem,7vw,3.5rem)] font-extrabold leading-[1.03] tracking-[-0.02em] text-ink">
          Twój plac stoi pusty w sobotę. W dzień meczu to są pieniądze.
        </h1>
        <p className="mt-5 max-w-2xl text-lead text-muted">
          Masz miejsce blisko Enea Stadionu albo MTP? Udostępniaj je na konkretne wydarzenia —
          kierowcy rezerwują i płacą z góry. Bez gotówki, bez negocjacji, bez telefonów.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#kalkulator" className={buttonVariants({ variant: "accent", size: "lg" })}>
            Policz, ile zarobisz
          </a>
          <a href="#jak-to-dziala" className={buttonVariants({ variant: "quiet", size: "lg" })}>
            Jak to działa
          </a>
        </div>
      </div>
    </section>
  );
}
