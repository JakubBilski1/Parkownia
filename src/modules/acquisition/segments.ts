import type { Segment } from "./types";

/**
 * The acquisition playbook, one entry per segment.
 *
 * This is opinionated on purpose. A list of addresses is worthless without an
 * answer to "what do I say when they open the door", and the answer differs more
 * by WHO OWNS THE LOT than by how far it is from the gate. Every `pitch` here is
 * written to be said out loud, in person — because cold e-mail is off the table
 * (docs/LEGAL_RESEARCH.md §2.2: art. 398 PKE covers B2B too), which leaves
 * inbound, post, and walking in.
 */

/** Where a segment lands in the queue. A is this week, C is inbound-only. */
export type Tier = "A" | "B" | "C";

export type SegmentPlaybook = {
  label: string;
  /** One line: why this segment's lot is empty exactly when we need it. */
  why: string;
  /** Who can actually sign. Getting this wrong costs weeks. */
  decisionMaker: string;
  /** Realistic time from first contact to a published parking. */
  cycle: string;
  /** The opening, said out loud. */
  pitch: string;
  /** The objection that kills the deal if you have no answer ready. */
  risk: string;
  /** The legal way in for this segment. */
  channel: string;
  tier: Tier;
};

export const SEGMENT_PLAYBOOK: Record<Segment, SegmentPlaybook> = {
  DEALER: {
    label: "Salon / serwis / komis",
    why: "Plac ogrodzony, ze szlabanem i kamerami, zamknięty wieczorami i w weekendy — dokładnie w godzinach meczów. Koszt krańcowy zero.",
    decisionMaker: "Właściciel albo kierownik oddziału — jedna osoba, na miejscu.",
    cycle: "Dni. Najkrótszy cykl w całym zestawie.",
    pitch:
      "Wasz plac stoi pusty w sobotę o 18:00, a 500 metrów dalej ludzie krążą i szukają miejsca. Wpuszczacie tylu, ilu chcecie, na wydzieloną część, z kodem. Nie musi być nikogo z Waszej strony.",
    risk:
      "Boją się o towar na placu — nowe auta, uszkodzenia, ubezpieczenie. Nie sprzedawaj całego placu: zaproponuj wydzieloną strefę przy wyjeździe i pisemne wyłączenie ekspozycji.",
    channel: "Wejście na plac w godzinach pracy. Pytaj o kierownika, nie o handlowca.",
    tier: "A",
  },

  WORSHIP: {
    label: "Parafia",
    why: "Plac pusty poza niedzielnym rankiem. Mecze wieczorne i targi w tygodniu nie kolidują prawie nigdy.",
    decisionMaker: "Proboszcz. Decyzja to jedna rozmowa; przy większej umowie potrzebna zgoda kurii.",
    cycle: "Dni do wstępnego „tak”, tygodnie do umowy.",
    pitch:
      "Parafia ma plac, który stoi pusty w dni meczowe. To stały dochód na remont, bez żadnej pracy po Waszej stronie — my obsługujemy wjazd i płatność, Wy decydujecie, w które dni się zgadzacie.",
    risk:
      "Kolizja z nabożeństwem i obawa o wizerunek („handel na kościelnym”). Przyjdź z kalendarzem eventów i pokaż, w które dni NIE sprzedajesz. Zostaw decyzję per-wydarzenie — to dokładnie to, co robi deklaracja hosta.",
    channel: "Wizyta w kancelarii parafialnej. Nie mail, nie telefon.",
    tier: "A",
  },

  INDUSTRIAL: {
    label: "Zakład / magazyn / hala",
    why: "Puste po godzinach i w weekendy, duże utwardzone powierzchnie, zwykle już ogrodzone.",
    decisionMaker: "Właściciel lub kierownik zakładu. Krótka ścieżka, jeśli firma jest lokalna.",
    cycle: "2–4 tygodnie.",
    pitch:
      "Plac manewrowy stoi od piątku 16:00 do poniedziałku. Możemy go wypełnić w 8 weekendów i to jest przychód z majątku, który już macie.",
    risk:
      "Ruch TIR-ów, BHP i strefa zakładowa. Ustal wjazd i strefę tak, żeby nie krzyżowały się z ruchem technologicznym; przy zakładach z monitoringiem ppoż. spytaj o drogi pożarowe.",
    channel: "Wizyta na portierni z prośbą o kontakt do kierownika. Poczta na adres spółki.",
    tier: "A",
  },

  RESIDENTIAL: {
    label: "Spółdzielnia / wspólnota",
    why: "Mieszkańcy już dziś mają zastawione podwórza w dni meczowe. Tu nie sprzedajesz przychodu — sprzedajesz koniec problemu.",
    decisionMaker: "Zarząd wspólnoty albo administrator. Uchwała może wymagać zebrania.",
    cycle: "Tygodnie. Szybciej, jeśli trafisz przed zebraniem.",
    pitch:
      "W dniu meczu i tak stawiają Wam samochody na podwórzu. Możecie na tym zarabiać i decydować, kto wjeżdża — konkretna liczba miejsc, konkretne godziny, kod dla konkretnego kierowcy. Zamiast szlabanu, który ktoś objedzie.",
    risk:
      "Sprzeciw mieszkańców i pytanie „kto odpowiada za szkodę”. Idź z liczbą miejsc mniejszą niż realna, żeby mieszkańcy nie stracili swoich; przygotuj odpowiedź o ubezpieczeniu, zanim ktoś zapyta.",
    channel:
      "Pismo do zarządu (poczta jest poza PKE), a przy okazji post w lokalnej grupie — publikacja, nie mailing.",
    tier: "A",
  },

  OFFICE: {
    label: "Biurowiec",
    why: "Puste w weekendy, a mecze i targi to głównie weekendy. Miejsca są utwardzone, oznaczone i zwykle za szlabanem.",
    decisionMaker: "Facility manager → właściciel budynku. Dwa kroki, nie jeden.",
    cycle: "4–8 tygodni.",
    pitch:
      "Wasz garaż w weekend jest pusty. To pozycja przychodowa z powierzchni, którą już utrzymujecie — bez żadnej zmiany w obsłudze budynku.",
    risk:
      "Umowa najmu często zabrania podnajmu miejsc, a najemcy mają je przypisane. Pytaj od razu, kto jest właścicielem miejsc: zarządca czy najemcy. Jeśli najemcy — to nie jedna rozmowa, a dwadzieścia.",
    channel: "Recepcja → facility manager. Wizyta osobista, wizytówka, jednostronicowa wycena.",
    tier: "B",
  },

  SCHOOL: {
    label: "Szkoła / przedszkole / uczelnia",
    why: "30–80 miejsc, puste wieczorami i w weekendy. Największe pojedyncze place w tym zestawieniu.",
    decisionMaker:
      "Przy szkołach miejskich: Wydział Oświaty UM Poznania, NIE dyrektor. Uczelnie decydują same (kanclerz / dział administracyjny).",
    cycle: "2–3 miesiące dla szkół miejskich. Uczelnie szybciej.",
    pitch:
      "Boisko i plac przy szkole stoją puste w weekend. To dochód dla placówki z majątku miasta, na umowie użyczenia albo najmu okazjonalnego.",
    risk:
      "Cykl decyzyjny nie zmieści się w tym sezonie i procedura może wymagać przetargu. Złóż wniosek TERAZ, żeby zdążyć na wiosnę — ale nie licz na te miejsca w kalkulacji na jesień.",
    channel:
      "Pismo do Wydziału Oświaty + rozmowa z dyrektorem jako rzecznikiem sprawy. Uczelnie: dział administracyjny.",
    tier: "B",
  },

  SPORTS: {
    label: "Obiekt sportowy",
    why: "Własny plac, ale bywa zajęty w te same weekendy. Sprawdzić kalendarz obiektu, zanim wejdziesz.",
    decisionMaker: "Zarządca obiektu — miejska spółka albo klub.",
    cycle: "4–8 tygodni.",
    pitch:
      "Kiedy u Was nie ma zawodów, a na Bułgarskiej jest mecz, Wasz parking może pracować. Sprzedajemy tylko te dni, które sami zaznaczycie.",
    risk: "Kolizja terminów jest regułą, nie wyjątkiem. Bez deklaracji per-wydarzenie to się nie uda.",
    channel: "Wizyta w administracji obiektu.",
    tier: "B",
  },

  COMMERCIAL: {
    label: "Obiekt komercyjny / usługowy",
    why: "Zbiorczy worek na place przy firmach usługowych i handlowo-biurowych. Trzeba obejrzeć każdy z osobna.",
    decisionMaker: "Zależnie od obiektu — ustal przy pierwszej wizycie.",
    cycle: "2–6 tygodni.",
    pitch:
      "Macie plac, który po godzinach stoi pusty, a 10 minut stąd jest 40 tysięcy ludzi szukających miejsca. Zaczynamy od jednego wydarzenia na próbę.",
    risk: "Segment niejednorodny — połowa tych punktów to w rzeczywistości coś innego. Weryfikuj w terenie przed rozmową.",
    channel: "Wizyta. Dane kontaktowe z CEIDG/KRS, jeśli obiekt jest zamknięty.",
    tier: "B",
  },

  HOTEL: {
    label: "Hotel",
    why: "Część miejsc zajęta gośćmi, ale hotele pod MTP mają nadwyżkę poza okresem targowym.",
    decisionMaker: "Dyrektor hotelu.",
    cycle: "2–4 tygodnie.",
    pitch:
      "Miejsca, których nie sprzedaliście gościom, mogą pracować w dniu meczu. Wy ustawiacie limit, my nie ruszamy rezerwy dla gości.",
    risk:
      "Konflikt z obsługą gości jest realny i zabija relację, jeśli raz zabraknie miejsca. Sprzedawaj wyłącznie nadwyżkę z twardym limitem.",
    channel: "Rozmowa z dyrektorem. Recepcja przekaże, jeśli przyjdziesz osobiście.",
    tier: "B",
  },

  RETAIL: {
    label: "Handel / market",
    why: "Duże place, ale sklep chce ich dla własnych klientów dokładnie w weekend, kiedy jest mecz.",
    decisionMaker: "Kierownik sklepu → centrala sieci. Sieci prawie nigdy nie decydują lokalnie.",
    cycle: "Miesiące przy sieciach. Lokalny sklep — tygodnie.",
    pitch:
      "Po zamknięciu sklepu plac stoi pusty, a mecze są wieczorem. Sprzedajemy wyłącznie godziny po Waszym zamknięciu.",
    risk:
      "Bezpośredni konflikt z podstawowym biznesem. Wchodź tylko tam, gdzie mecz jest po zamknięciu, i nie zaczynaj od sieci.",
    channel: "Kierownik sklepu, żeby dostać kontakt do działu nieruchomości sieci.",
    tier: "C",
  },

  HOSPITAL: {
    label: "Szpital / przychodnia",
    why: "Praktycznie nigdy nie jest pusty, a miejsca są potrzebne pacjentom.",
    decisionMaker: "Dyrekcja placówki.",
    cycle: "Miesiące.",
    pitch: "Brak sensownego pitchu. Nie zajmuj tym czasu, dopóki nie zgłoszą się sami.",
    risk: "Zajęcie miejsc pacjentom to ryzyko wizerunkowe większe niż cały przychód z tego placu.",
    channel: "Wyłącznie inbound.",
    tier: "C",
  },

  PARKING_OTHER: {
    label: "Parking bez właściciela w danych",
    why: "OSM wie, że to parking, ale nie wie czyj. Trzeba pojechać i zobaczyć.",
    decisionMaker: "Nieznany — do ustalenia w terenie albo w księdze wieczystej.",
    cycle: "Nieznany.",
    pitch:
      "Najpierw rekonesans: czy plac jest ogrodzony, czy ma szlaban, czyje logo stoi przy wjeździe. Dopiero potem rozmowa.",
    risk:
      "Połowa z tych placów okaże się miejską drogą wewnętrzną albo cudzą własnością bez możliwości najmu. Weryfikuj przed rozmową, nie po.",
    channel: "Rekonesans pieszy. Geoportal / księga wieczysta przy większych placach.",
    tier: "B",
  },

  OPERATOR: {
    label: "Operator komercyjny (już sprzedaje)",
    why: "Nie jest to akwizycja podaży, tylko partnerstwo. Oni już mają płatny parking i własnych klientów.",
    decisionMaker: "Dział sprzedaży / właściciel operatora.",
    cycle: "4–8 tygodni.",
    pitch:
      "Nie chcemy Waszego parkingu. Chcemy być kanałem sprzedaży na te wydarzenia, których nie wypełniacie sami — prowizja liczona wyłącznie od przychodu, którego dziś nie macie.",
    risk:
      "Widzą w Tobie konkurenta i mogą mieć własny system rezerwacji. Wchodź z przychodem inkrementalnym, nigdy z propozycją zastąpienia ich systemu.",
    channel: "Kontakt firmowy ze strony operatora — to jest B2B inbound-równoważny, bo oni sprzedają publicznie.",
    tier: "B",
  },
};

export const TIER_LABEL: Record<Tier, string> = {
  A: "Idź w tym tygodniu",
  B: "Kolejka",
  C: "Tylko inbound",
};

export const TIER_HINT: Record<Tier, string> = {
  A: "Krótki cykl decyzyjny, plac pusty w godzinach eventu, jedna osoba decyduje.",
  B: "Warto, ale decyzja przechodzi przez łańcuch albo wymaga rekonesansu.",
  C: "Konflikt z podstawowym biznesem właściciela. Nie wydawaj na to wizyty.",
};

export const VENUE_LABEL = {
  ENEA: "Enea Stadion",
  MTP: "MTP",
} as const;
