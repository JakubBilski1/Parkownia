export type FaqItem = { q: string; a: string };

/**
 * The most important section after the calculator. Where an answer needs a legal
 * or business decision we have NOT made, the copy stays neutral and carries a
 * TODO — never an invented condition, never legal advice (see docs/LEGAL_RESEARCH.md).
 * Exported so the FAQPage JSON-LD stays in sync from a single source.
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Kto odpowiada, jeśli ktoś uszkodzi albo ukradnie auto na moim terenie?",
    // TODO(legal): finalna odpowiedź zależy od modelu (najem miejsca vs przechowanie)
    // i od audytu regulaminu — LEGAL_RESEARCH.md §2.5. Bez porady prawnej.
    a: "Zasady odpowiedzialności określa regulamin, który przygotowujemy z prawnikiem. Co do zasady udostępniasz miejsce postojowe, a nie bierzesz pojazd pod dozór — ale ostateczne warunki potwierdzamy przed startem. Chcesz je poznać wcześniej? Napisz do nas.",
  },
  {
    q: "Czy muszę mieć firmę? A jeśli jestem osobą prywatną?",
    // TODO(legal/tax): sposób rozliczenia (najem prywatny vs działalność) + DAC7 — do potwierdzenia.
    a: "Żeby się zgłosić, firma nie jest potrzebna. To, jak rozliczysz przychód, zależy od Twojej sytuacji — ustalimy to indywidualnie. Nie doradzamy podatkowo.",
  },
  {
    q: "Jak się rozliczamy — jaka prowizja i kiedy wypłata?",
    // TODO(finanse): dokumenty rozliczeniowe dla właścicieli (poza MVP wg docs/PAYMENTS.md).
    a: "Prowizja Parkowni to 50% od osób prywatnych i 30% od firm — potrącana automatycznie z płatności kierowcy; resztę dostajesz Ty. Wypłata trafia do Ciebie po wydarzeniu. Szczegóły dokumentów rozliczeniowych domykamy.",
  },
  {
    q: "Czy muszę być na miejscu fizycznie?",
    a: "Nie zawsze. Jeśli masz bramę na kod albo szlaban, wjazd jest samoobsługowy. Jeśli wpuszczasz ręcznie — skanujesz kod QR telefonem; działa też bez internetu.",
  },
  {
    q: "Co, jeśli ktoś zarezerwuje, a ja akurat potrzebuję placu?",
    a: "Udostępniasz konkretne wydarzenia, nie kalendarz na stałe. Jeśli na dany termin nie wystawisz miejsc, nikt ich nie zarezerwuje.",
  },
  {
    q: "Czy mogę wystawić tylko część miejsc?",
    a: "Tak. Na każde wydarzenie deklarujesz dokładnie tyle miejsc, ile chcesz udostępnić — resztę zostawiasz sobie.",
  },
  {
    q: "Czy to umowa na wyłączność?",
    a: "Nie. Miejsce jest Twoje — możesz je udostępniać, komu i kiedy chcesz.",
  },
  {
    q: "Co z podatkiem?",
    // TODO(tax): informacja o opodatkowaniu przychodu + raportowanie DAC7 do KAS — po decyzji, LEGAL_RESEARCH §2.6.
    a: "Przychód z udostępniania miejsca podlega opodatkowaniu, a zasady zależą od Twojej sytuacji. Nie doradzamy podatkowo — podpowiemy tylko, gdzie to sprawdzić.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="bg-surface-2">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:py-20 lg:px-6">
        <h2 className="font-display text-h1 font-extrabold tracking-tight text-ink">
          Pytania, które naprawdę zadajesz
        </h2>
        <div className="mt-8 divide-y divide-line border-y border-line">
          {FAQ_ITEMS.map((item) => (
            <details key={item.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lead font-semibold text-ink [&::-webkit-details-marker]:hidden">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-muted transition-transform duration-micro ease-out group-open:rotate-45 motion-reduce:transition-none"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-body text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
