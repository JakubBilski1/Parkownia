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

export function HowItWorks() {
  return (
    <section id="jak-to-dziala" className="border-b border-line bg-surface-2">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">Jak to działa</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.n}>
              {/* Ordinal stays ink, never the accent — the accent is reserved (§4). */}
              <span className="font-display text-[2.5rem] font-extrabold leading-none tabular-nums text-ink">
                {step.n}
              </span>
              <h3 className="mt-3 text-h3 font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-body text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
