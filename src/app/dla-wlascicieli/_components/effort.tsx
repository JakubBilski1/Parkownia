// Disarms the main objection: this is not a second job.
const WITHOUT = [
  "Bez gotówki do liczenia.",
  "Bez negocjacji o cenę.",
  "Bez telefonów od klientów.",
  "Bez obsługi zwrotów i reklamacji.",
  "Bez pilnowania, kto i kiedy przyjedzie.",
];

export function Effort() {
  return (
    <section className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <div className="max-w-2xl">
          <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">
            To mniej pracy, niż myślisz
          </h2>
          <p className="mt-3 text-lead text-muted">
            Płatność, rezerwacje i kontakt z kierowcą bierze na siebie Parkownia. Po Twojej stronie
            zostaje jedno: wpuścić auto na kod albo otworzyć bramę.
          </p>
        </div>
        <ul className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {WITHOUT.map((item) => (
            <li key={item} className="flex items-baseline gap-3 text-body text-ink">
              <span aria-hidden="true" className="select-none text-muted">
                —
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
