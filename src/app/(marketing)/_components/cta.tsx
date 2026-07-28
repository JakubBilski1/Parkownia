import { CtaForm } from "./cta-form";

/**
 * The page's last word. A visitor who read as far as the FAQ has already
 * decided they are interested and, by the serial-position effect
 * (DESIGN_PRINCIPLES §6.8), what sits at the end is what they leave with — so
 * the end is a way in, not a footer.
 *
 * The calculator higher up asks for an address before it will talk. This does
 * not: somebody who scrolled past it, or never realised the estimate had a
 * button under it, gets the same conversation without going back up.
 *
 * Set on --surface-2 rather than the page ground, so the block reads as one
 * object against the sections above it without needing a border or a box.
 */
export function Cta() {
  return (
    <section id="kontakt" className="border-b border-line bg-surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <p className="flex items-center gap-3 text-ui font-semibold uppercase tracking-[0.12em] text-muted">
              <span aria-hidden="true" className="h-px w-6 bg-line" />
              Zgłoszenie
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.75rem,4.2vw,2.5rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
              Zostaw adres. Resztę policzymy za Ciebie.
            </h2>
            <p className="mt-4 max-w-xl text-lead text-muted">
              Nie musisz nic dziś decydować ani niczego podpisywać. Odezwiemy się, powiemy, ile
              realnie da się zarobić na Twoim miejscu w najbliższych meczach i targach, i dopiero
              wtedy zdecydujesz.
            </p>

            {/* The three objections that stop somebody with the form already
                open. Each is a fact we can keep, not a promise. */}
            <ul className="mt-8 border-t border-line">
              {[
                "Bez zobowiązań i bez umowy na wyłączność.",
                "Odzywamy się w ciągu dwóch dni roboczych.",
                "Możesz zacząć od jednego meczu i sprawdzić, jak działa.",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-3 border-b border-line py-3 text-body text-ink"
                >
                  <span aria-hidden="true" className="select-none text-muted">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <CtaForm />
          </div>
        </div>
      </div>
    </section>
  );
}
