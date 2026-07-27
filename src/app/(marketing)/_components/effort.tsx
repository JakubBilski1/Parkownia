import { SectionHead } from "./section-head";

// Disarms the main objection: this is not a second job. Phrased as what the
// owner does NOT have to do, because that is the fear being answered.
const WITHOUT = [
  "Gotówki do liczenia",
  "Negocjacji o cenę",
  "Telefonów od klientów",
  "Obsługi zwrotów i reklamacji",
  "Pilnowania, kto i kiedy przyjedzie",
  "Umowy na wyłączność",
];

export function Effort() {
  return (
    <section className="border-b border-line bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHead
            className="lg:col-span-5"
            label="Nakład pracy"
            title="To mniej pracy, niż myślisz"
            lead="Płatność, rezerwacje i kontakt z kierowcą bierze na siebie Parkownia. Po Twojej stronie zostaje jedno: wpuścić auto na kod albo otworzyć bramę."
          />

          {/* "Bez" is set once, as the column's premise, instead of being repeated
              six times down the list. The em dash is the only mark in the row —
              an icon at every bullet would be decoration (§1). */}
          <div className="lg:col-span-7">
            <p className="text-ui font-semibold uppercase tracking-[0.12em] text-muted">Bez</p>
            <ul className="mt-3 border-t border-line">
              {WITHOUT.map((item) => (
                <li
                  key={item}
                  className="flex items-baseline gap-3 border-b border-line py-3 text-lead text-ink"
                >
                  <span aria-hidden="true" className="select-none text-muted">
                    —
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
