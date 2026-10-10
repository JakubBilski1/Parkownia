import { Plus } from "lucide-react";
import { COMMISSION_PCT } from "@/modules/leads/calc";
import { SectionHead } from "./section-head";

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
    //
    // Nie mówi już "regulamin, który przygotowujemy": regulamin JEST
    // opublikowany (/regulamin, wersja 2026-07-01) i ktoś, kto kliknie w stopkę,
    // zobaczy gotowy dokument — a poprzednia odpowiedź twierdziła, że go nie ma.
    // Sprzeczność w miejscu, w którym dostawca ocenia, czy można nam wierzyć.
    // Nowa wersja mówi dokładnie to, co §2 regulaminu: dokument obejmuje dziś
    // serwis, nie transakcje, a odpowiedzialność ustalamy indywidualnie.
    a: "Opublikowany regulamin opisuje dziś sam serwis — nie obejmuje jeszcze rezerwacji ani rozliczeń (§2). Zasady odpowiedzialności ustalamy więc indywidualnie, na piśmie, zanim wystawisz pierwsze miejsce. Co do zasady udostępniasz miejsce postojowe, a nie bierzesz auta pod dozór — ale nie chcemy, żebyś opierał się na jednym zdaniu z FAQ. Napisz, a prześlemy warunki.",
  },
  {
    q: "Czy muszę mieć firmę? A jeśli jestem osobą prywatną?",
    // TODO(legal/tax): sposób rozliczenia (najem prywatny vs działalność) + DAC7 — do potwierdzenia.
    a: "Żeby się zgłosić, firma nie jest potrzebna. To, jak rozliczysz przychód, zależy od Twojej sytuacji — ustalimy to indywidualnie. Nie doradzamy podatkowo.",
  },
  {
    q: "Jak się rozliczamy — jaka prowizja i kiedy wypłata?",
    // TODO(finanse): dokumenty rozliczeniowe dla właścicieli (poza MVP wg docs/PAYMENTS.md).
    a: `Prowizja Parkowni to ${COMMISSION_PCT.business}% — tyle samo dla osób prywatnych i firm — potrącana automatycznie z płatności kierowcy; resztę dostajesz Ty. Wypłata trafia do Ciebie po wydarzeniu. Szczegóły dokumentów rozliczeniowych domykamy.`,
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
    <section id="faq" className="bg-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:py-20 lg:px-6">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-10">
          <SectionHead
            className="lg:col-span-4"
            label="FAQ"
            title="Pytania, które naprawdę zadajesz"
            lead="Tam, gdzie odpowiedź zależy od decyzji prawnej, której jeszcze nie podjęliśmy, piszemy to wprost zamiast zmyślać warunek."
          />

          <div className="border-t border-line lg:col-span-8">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group border-b border-line">
                <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 py-4 text-lead font-semibold text-ink transition-colors duration-micro ease-out hover-hover:hover:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <Plus
                    size={20}
                    aria-hidden="true"
                    className="shrink-0 text-muted transition-transform duration-micro ease-out group-open:rotate-45 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-2xl pb-5 text-body text-muted">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
