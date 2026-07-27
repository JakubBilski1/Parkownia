import { SectionHead } from "./section-head";

// A real temporal sequence, so numbered steps are earned (not decorative
// 01/02/03). Owner's point of view, not the driver's.
const STEPS = [
  {
    n: 1,
    title: "Dodajesz obiekt",
    body: "Adres, liczba miejsc, wysokość wjazdu. Zajmuje minutę.",
  },
  {
    n: 2,
    title: "Ustawiasz dostępność na wydarzenia",
    body: "Wybierasz konkretne mecze i targi, na które udostępniasz miejsca. Reszta czasu jest Twoja.",
  },
  {
    n: 3,
    title: "Kierowca rezerwuje i płaci z góry",
    body: "Widzi Twoje miejsce na mapie, rezerwuje i płaci BLIK-iem albo kartą — zanim przyjedzie.",
  },
  {
    n: 4,
    title: "Wpuszczasz na kod QR",
    body: "Skanujesz kod telefonem albo otwierasz bramę. Pieniądze trafiają do Ciebie po wydarzeniu.",
  },
];

/**
 * An index, not a card grid. Four cards in a row is the shape every generated
 * landing page reaches for (§1); rules and aligned columns say the same thing
 * and read as something a person set.
 */
export function HowItWorks() {
  return (
    <section id="jak-to-dziala" className="border-b border-line bg-surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <SectionHead
          label="Jak to działa"
          title="Cztery kroki, z czego trzy robisz raz"
          lead="Pierwsze dwa ustawiasz na starcie. Potem zostaje wpuszczenie auta — i przelew."
        />

        <ol className="mt-12 border-t border-line">
          {STEPS.map((step) => (
            <li
              key={step.n}
              className="grid gap-2 border-b border-line py-6 sm:grid-cols-12 sm:gap-6 sm:py-7"
            >
              {/* Ordinal stays ink, never the accent — the accent is reserved (§4). */}
              <span
                aria-hidden="true"
                className="font-display text-h2 font-extrabold leading-none tabular-nums text-muted sm:col-span-1"
              >
                {step.n}
              </span>
              <h3 className="text-h3 font-semibold text-ink sm:col-span-4">{step.title}</h3>
              <p className="text-body text-muted sm:col-span-7">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
