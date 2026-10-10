import { COMMISSION_PCT, revenueEstimate } from "@/modules/leads/calc";

/**
 * Is 30% from a company and 50% from a private person a sensible split?
 *
 * Everything here is arithmetic on the app's own numbers — the rate bands from
 * modules/leads/calc, the commission from commission_rules via COMMISSION_PCT —
 * so the page cannot drift away from what the booking flow actually charges.
 * The conclusion is argued, not asserted: see FINDINGS at the bottom.
 */

/**
 * The two rates this analysis argues against — the 2026-01-01 seed, in force until
 * 2026-10-10. Pinned, not read from COMMISSION_PCT: the owner acted on the finding
 * (one 25% rate for everybody, see DECIDED), and the arithmetic below only makes
 * sense against the split it was written about.
 */
export const CURRENT = { individual: 50, business: 30 } as const;

/** What the analysis led to — the live rates. */
export const DECIDED = COMMISSION_PCT;

/**
 * What the host does INSTEAD of using us. This is the number that decides whether
 * a commission is sustainable, and it is wildly different by segment.
 *
 * A private person with a driveway already has a working alternative: a cardboard
 * sign and cash. It is untaxed, needs no app, and has existed near every stadium
 * in Europe for fifty years. We price against that, whether we like it or not.
 *
 * A company cannot run a cash operation — no invoice, no VAT, no liability cover,
 * and a facility manager will not take banknotes at a barrier. Its realistic
 * alternative is "do nothing", which earns zero.
 */
export const OUTSIDE_OPTION = {
  /** Cash-at-the-gate rate a private host can get with no platform, in grosze. */
  individualCashRateGr: 3000,
  /** Realistic fill without pre-booking: no guarantee, only passing traffic. */
  individualCashFillPct: 75,
} as const;

export type Scenario = {
  key: string;
  label: string;
  owner: "INDIVIDUAL" | "BUSINESS";
  spots: number;
  /** Per-event, per-spot rate in grosze — the mid of a band from leads/calc. */
  rateGr: number;
  events: number;
  note: string;
};

/**
 * Four shapes of host that actually exist near these two venues, sized from the
 * research: a driveway, a small yard, a works car park, an anchor lot.
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    key: "driveway",
    label: "Podjazd przy domu",
    owner: "INDIVIDUAL",
    spots: 2,
    rateGr: 4000,
    events: 9,
    note: "Typowy lead z landingu: osoba prywatna, 5–10 min od Enei.",
  },
  {
    key: "yard",
    label: "Podwórze / mała posesja",
    owner: "INDIVIDUAL",
    spots: 6,
    rateGr: 5500,
    events: 9,
    note: "Osoba prywatna blisko bramy — najlepszy realny wariant w tym segmencie.",
  },
  {
    key: "works",
    label: "Plac firmowy",
    owner: "BUSINESS",
    spots: 40,
    rateGr: 4000,
    events: 9,
    note: "Zakład albo biurowiec 5–10 min od Enei. Trzon podaży.",
  },
  {
    key: "anchor",
    label: "Duży plac (anchor)",
    owner: "BUSINESS",
    spots: 150,
    rateGr: 5500,
    events: 9,
    note: "Jeden taki plac to więcej miejsc niż dwadzieścia podjazdów.",
  },
];

export type ScenarioResult = {
  scenario: Scenario;
  grossGr: number;
  /** Host take-home per season at the rate in force today. */
  currentNetGr: number;
  currentPct: number;
  /** Host take-home at the proposed steady-state rate. */
  proposedNetGr: number;
  proposedPct: number;
  /** Host take-home at the founding rate. */
  foundingNetGr: number;
  /** What the host earns doing it without us — null where there is no such option. */
  outsideOptionGr: number | null;
  /**
   * Season zloty the host gains by choosing us over their outside option, at
   * today's rate. Negative or near-zero means the commission is unsellable.
   */
  currentAdvantageGr: number | null;
  proposedAdvantageGr: number | null;
};

/** Proposed steady-state rates. Argued in FINDINGS. */
export const PROPOSED = { individual: 30, business: 25 } as const;
/** Proposed launch rate for the first cohort, time-boxed. */
export const FOUNDING_PCT = 20;
/** Above this many spots, an anchor lot earns the volume tier. */
export const ANCHOR_SPOTS = 40;
export const ANCHOR_PCT = 20;
/** Below this, one field visit can never pay for itself. See FINDINGS §5. */
export const MIN_VIABLE_SPOTS = 4;

function outsideOptionFor(s: Scenario): number | null {
  if (s.owner === "BUSINESS") return null; // "do nothing" earns zero, not a number
  const filled = Math.round((s.spots * OUTSIDE_OPTION.individualCashFillPct) / 100);
  return filled * OUTSIDE_OPTION.individualCashRateGr * s.events;
}

export function evaluate(s: Scenario): ScenarioResult {
  const currentPct = s.owner === "BUSINESS" ? CURRENT.business : CURRENT.individual;
  const proposedPct = s.owner === "BUSINESS" ? PROPOSED.business : PROPOSED.individual;

  const at = (pct: number) =>
    revenueEstimate({ rateGr: s.rateGr, spots: s.spots, events: s.events, commissionPct: pct });

  const current = at(currentPct);
  const proposed = at(proposedPct);
  const founding = at(FOUNDING_PCT);
  const outside = outsideOptionFor(s);

  return {
    scenario: s,
    grossGr: current.annualGrossGr,
    currentNetGr: current.annualNetGr,
    currentPct,
    proposedNetGr: proposed.annualNetGr,
    proposedPct,
    foundingNetGr: founding.annualNetGr,
    outsideOptionGr: outside,
    currentAdvantageGr: outside == null ? null : current.annualNetGr - outside,
    proposedAdvantageGr: outside == null ? null : proposed.annualNetGr - outside,
  };
}

export const SCENARIO_RESULTS: readonly ScenarioResult[] = SCENARIOS.map(evaluate);

export type Finding = {
  title: string;
  verdict: "BAD" | "OK" | "FIX";
  body: string;
};

/**
 * The argument, in order. §1 is the one that matters: the split is not merely
 * steep, it is pointed the wrong way.
 */
export const FINDINGS: readonly Finding[] = [
  {
    title: "Wyższa stawka trafia w segment z LEPSZĄ alternatywą — to jest odwrotnie niż powinno",
    verdict: "BAD",
    body:
      "Osoba prywatna z podjazdem ma gotową alternatywę: karton z napisem i gotówka. Bez podatku, bez aplikacji, " +
      "działa pod każdym stadionem w Europie od pięćdziesięciu lat. Firma tej alternatywy NIE MA — facility manager " +
      "nie będzie przyjmował banknotów przy szlabanie, bez faktury i bez ubezpieczenia. Realną opcją firmy jest " +
      "„nic nie robić”, czyli zero. Podręcznikowo: wyższą prowizję bierze się od strony o SŁABSZEJ pozycji " +
      "negocjacyjnej. My robimy dokładnie przeciwnie — 50% od tego, kto może odejść w pięć minut, i 30% od tego, kto nie może.",
  },
  {
    title: "Przy 50% nasza przewaga nad kartonem to kilkadziesiąt złotych na wydarzenie",
    verdict: "BAD",
    body:
      "Tabela wyżej liczy to wprost. Dla podwórza na 6 miejsc blisko bramy: u nas przy 50% host zostaje z połową " +
      "stawki, a na własną rękę bierze całe 30 zł od 75% miejsc. Różnica jest tak mała, że nie kupuje zmiany " +
      "zachowania — a my w zamian żądamy rejestracji, KYC, zgód i zdania się na obcą aplikację. Prowizja, przy " +
      "której racjonalny host wybiera karton, nie jest wysoką prowizją. Jest prowizją, która nigdy się nie pobierze.",
  },
  {
    title: "50% od 2 miejsc to 360 zł na sezon — kwota, dla której nikt nie otworzy drzwi dwa razy",
    verdict: "BAD",
    body:
      "To nie jest argument za podniesieniem stawki, tylko dowód, że segment mikro jest źle zaadresowany. " +
      "Zamiast dławić go prowizją, powiedz wprost, od ilu miejsc to ma sens (patrz „minimum”), a tym, których " +
      "naprawdę chcesz — osobom z 5+ miejscami pod bramą — daj stawkę, która wygrywa z gotówką.",
  },
  {
    title: "Prowizja na tym etapie jest kosztem akwizycji, nie źródłem marży",
    verdict: "FIX",
    body:
      "Na produkcji jest jeden parking i ma status REJECTED. Take rate liczony od zera daje zero, niezależnie czy " +
      "wynosi 30% czy 70%. Wąskim gardłem jest podaż, więc prowizja jest dziś dźwignią do WYDANIA, nie do zbierania. " +
      "Stawka założycielska 20% dla pierwszej kohorty, zamknięta w czasie umową, daje jednocześnie powód, żeby " +
      "podpisać TERAZ — a tego właśnie potrzebuje sprzedaż w terenie.",
  },
  {
    title: "Asymetria wyjdzie na jaw w najgorszym momencie — przy stole ze spółdzielnią",
    verdict: "FIX",
    body:
      "Stawki są na landingu. Zarząd wspólnoty, który usłyszy „zostaje u Was 50%”, zapyta, ile zostaje firmie — " +
      "i dowie się, że 70%. Właśnie stworzyłeś urazę w najlepiej konwertującym segmencie. Jeśli różnica ma zostać, " +
      "musi mieć czytelny powód wypowiedziany wprost („firmy rozliczają się fakturą i obsługują wjazd same”), " +
      "a nie wyglądać na uznaniową.",
  },
  {
    title: "Podatek pogłębia różnicę, której klient i tak nie widzi w tabeli",
    verdict: "FIX",
    body:
      "Firma traktuje prowizję jako koszt i odlicza ją; osoba prywatna z najmu prywatnego płaci ryczałt 8,5% od tego, " +
      "co dostała. Efektywna luka między segmentami jest więc szersza niż 50 do 30 na papierze. Do potwierdzenia " +
      "z księgowym, ale kierunek jest jednoznaczny i wart sprawdzenia przed pierwszą rozmową z osobą prywatną.",
  },
  {
    title: "Kierunek różnicy da się obronić — jej rozmiar nie",
    verdict: "OK",
    body:
      "Osoba prywatna faktycznie kosztuje więcej w obsłudze: mniejszy plac, więcej pytań, większa zmienność jakości, " +
      "ten sam koszt stały na transakcję. Więc stawka indywidualna WYŻSZA od firmowej jest uzasadniona. " +
      "Tylko że ta różnica to jakieś 5 punktów procentowych kosztu obsługi, a nie dwadzieścia. Stąd propozycja " +
      "30 / 25, a nie 50 / 30 i nie jedna stawka dla wszystkich.",
  },
  {
    title: "Mechanizm stawki założycielskiej JUŻ ISTNIEJE w kodzie — nie trzeba migracji",
    verdict: "OK",
    body:
      "commission_rules ma scope USER i PARKING z wersjonowaniem po validFrom, a rozstrzyga to " +
      "resolveCommissionRatePct w modules/payouts/service.ts pod tą samą blokadą wiersza co rezerwacja. " +
      "Stawkę dla pierwszej kohorty wpisujesz jako nadpisania per-host w /admin/prowizje — bez zmiany schematu " +
      "i bez ruszania stawek globalnych. Historia zostaje audytowalna, bo rezerwacje zamrażają stawkę przy zakupie.",
  },
];

export const RECOMMENDATION = [
  {
    label: "Stawka założycielska",
    value: `${FOUNDING_PCT}%`,
    detail:
      "Dla pierwszych ~20 hostów, oba segmenty, zamknięta umową na 12 miesięcy. To jest powód, żeby podpisać w tym tygodniu, a nie po sezonie.",
  },
  {
    label: "Docelowo — firma",
    value: `${PROPOSED.business}%`,
    detail: "Z 30%. Mieści się w normie marketplace'ów (15–30%) i nie zaprasza do obejścia.",
  },
  {
    label: "Docelowo — osoba prywatna",
    value: `${PROPOSED.individual}%`,
    detail:
      "Z 50%. Zostaje wyżej niż firmowa, bo obsługa faktycznie kosztuje więcej — ale wygrywa z gotówką przy szlabanie.",
  },
  {
    label: `Próg wolumenowy (${ANCHOR_SPOTS}+ miejsc)`,
    value: `${ANCHOR_PCT}%`,
    detail:
      "Duże place to trzon podaży i jedyny sposób, żeby sprzedaż w terenie się spinała. Trzymaj je taniej niż resztę.",
  },
  {
    label: "Minimum miejsc",
    value: `${MIN_VIABLE_SPOTS}`,
    detail:
      "Zamiast dławić mikro-podaż prowizją, powiedz wprost, od ilu miejsc to działa. Uczciwsze i tańsze w obsłudze.",
  },
] as const;
