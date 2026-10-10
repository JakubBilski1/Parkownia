import {
  AlertTriangle,
  BedDouble,
  Building2,
  Car,
  CheckCircle2,
  Church,
  CircleDollarSign,
  Clock,
  Dumbbell,
  ExternalLink,
  Eye,
  Factory,
  Footprints,
  GraduationCap,
  Home,
  Inbox,
  Layers,
  Lightbulb,
  Lock,
  MapPin,
  Search,
  ShoppingCart,
  SquareParking,
  Stethoscope,
  Store,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import { Select } from "@/components/ui/select";
import { formatSpots } from "@/lib/format";
import {
  addressOf,
  bySegment,
  byVenue,
  CANDIDATE_SITES,
  filterSites,
  osmUrl,
  RECON_SITES,
  RESIDENTIAL_CLUSTERS,
  SEARCH_RADIUS_M,
  SEGMENT_PLAYBOOK,
  SNAPSHOT_DATE,
  satelliteUrl,
  TIER_HINT,
  TIER_LABEL,
  totals,
  VENUE_LABEL,
} from "@/modules/acquisition";
import {
  FINDINGS,
  RECOMMENDATION,
  SCENARIO_RESULTS,
  CURRENT,
  DECIDED,
  PROPOSED,
} from "@/modules/acquisition/economics";
import type { Segment, Tier } from "@/modules/acquisition";
import { Metric, PageHeader, Section, TableScroll, Td, Th } from "../../_components/layout-parts";

/** A card that carries a claim and its consequence, not decoration. */
function Note({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        tone === "warn"
          ? "flex flex-col gap-2 rounded-card border border-danger bg-danger-soft p-4"
          : "flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-4"
      }
    >
      <h3 className="flex items-center gap-2 font-display text-body font-bold text-ink">
        {tone === "warn" ? <AlertTriangle size={16} aria-hidden="true" /> : null}
        {title}
      </h3>
      <div className="flex flex-col gap-2 text-ui text-muted [&_strong]:text-ink">{children}</div>
    </div>
  );
}

const BASIS_LABEL = {
  tag: "z OSM",
  area: "z powierzchni",
  footprint: "z obrysu",
} as const;

const CONFIDENCE_LABEL = {
  inside: "wewnątrz",
  adjacent: "obok",
  none: "nieprzypisany",
} as const;

/** Badge demands an icon — status has to read without hue. One per segment. */
const SEGMENT_ICON: Record<Segment, LucideIcon> = {
  DEALER: Car,
  WORSHIP: Church,
  INDUSTRIAL: Factory,
  RESIDENTIAL: Home,
  OFFICE: Building2,
  SCHOOL: GraduationCap,
  SPORTS: Dumbbell,
  COMMERCIAL: Store,
  HOTEL: BedDouble,
  RETAIL: ShoppingCart,
  HOSPITAL: Stethoscope,
  PARKING_OTHER: SquareParking,
  OPERATOR: CircleDollarSign,
};

const TIER_ICON = { A: Footprints, B: Clock, C: Inbox } as const;

const VERDICT_ICON = { BAD: XCircle, FIX: Wrench, OK: CheckCircle2 } as const;

const VERDICT_LABEL = { BAD: "Źle", FIX: "Do zmiany", OK: "OK" } as const;

const VERDICT_TONE = { BAD: "bad", FIX: "neutral", OK: "ok" } as const;

/** Tier drives the tone everywhere a segment appears, so keep it in one place. */
const tierTone = (tier: Tier) => (tier === "A" ? "ok" : tier === "B" ? "neutral" : "muted");

/** The segment icon on its own, where a Badge would repeat the heading beside it. */
function SegmentGlyph({ segment }: { segment: Segment }) {
  const Icon = SEGMENT_ICON[segment];
  return <Icon size={16} aria-hidden="true" className="shrink-0 text-muted" />;
}


/** Resolved search params — the page awaits them before handing them over. */
export type ResearchParams = {
  segment?: string;
  venue?: string;
  tier?: string;
  supply?: string;
  q?: string;
};

export function ResearchView({ params }: { params: ResearchParams }) {
  const t = totals();
  const venues = byVenue();
  const segments = bySegment();
  const sites = filterSites(params);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Akwizycja podaży"
        description={`Zdjęcie OpenStreetMap z ${SNAPSHOT_DATE}, promień ${SEARCH_RADIUS_M} m od Enei i MTP, przefiltrowane przez model spacerowy aplikacji (15 min = 923 m w linii prostej) i próg 10 miejsc. To lista startowa, nie rynek — dlaczego, na dole strony.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Place w zasięgu"
          value={t.lots}
          definition={`Poligony amenity=parking, ≥10 miejsc, ≤15 min pieszo. ${t.taggedCapacity} z nich ma pojemność wprost z OSM.`}
          icon={SquareParking}
        />
        <Metric
          label="Miejsca do zdobycia"
          value={formatSpots(t.greenfieldSpots)}
          definition={`Na ${t.greenfieldLots} placach, których dziś nikt nie sprzedaje. To jest realny cel akwizycji.`}
          icon={MapPin}
        />
        <Metric
          label="Już sprzedawane"
          value={formatSpots(t.paidSpots)}
          definition={`${t.paidLots} placów z fee=yes — APCOA, Grupa MTP i inni. Partnerstwo albo konkurencja, nie akwizycja.`}
          icon={CircleDollarSign}
        />
        <Metric
          label="Do rekonesansu"
          value={t.reconSites}
          definition={`Właściciele w zasięgu, których placu OSM nie zna. Bez liczby miejsc — trzeba pojechać i zobaczyć.`}
          icon={Search}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Note title="Ile podpisów naprawdę potrzebujesz">
          <p>
            Żeby mapa przestała wyglądać na pustą, wystarczy <strong>300–500 miejsc</strong>. Przy
            średniej wielkości placu z tej listy to <strong>8–12 rozmów</strong>, nie kampania.
            Dlatego to jest sprzedaż w terenie, a nie mailing — i dlatego kolejność w kolumnie
            „Priorytet” jest ważniejsza niż długość listy.
          </p>
          <p>
            Koszt jednej wizyty jest taki sam przy placu na 15 miejsc i na 150.{" "}
            <strong>Idź tam, gdzie są miejsca.</strong>
          </p>
        </Note>

        <Note tone="warn" title="Nie zaczynaj akwizycji, dopóki nie można kupić">
          <p>
            <code>PAYMENT_PROVIDER</code> jest nieuzupełniony, więc dziś nikt nie kupi ani jednego
            miejsca. Pierwszy host, który wystawi plac i dostanie zero rezerwacji, powie o tym
            pozostałym — a ci ludzie administrują nieruchomościami na tej samej ulicy i znają się.
          </p>
          <p>
            Kolejność jest nieodwracalna: <strong>płatności → jeden plac → pierwsza sprzedana
            rezerwacja jako dowód → dopiero lista poniżej.</strong>
          </p>
        </Note>
      </div>

      {/* ---------------------------------------------------------- venues */}

      <Section
        title="Podział na obiekty"
        hint="Enea i MTP są od siebie 3,7 km, więc żaden plac nie łapie obu. Liczba wydarzeń pochodzi z tabeli events."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {venues.map((v) => (
            <div key={v.venue} className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-h3 font-bold text-ink">{VENUE_LABEL[v.venue]}</h3>
                <span className="num text-ui text-muted">{v.events} wydarzeń</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-ui">
                <div>
                  <dt className="text-muted">Place</dt>
                  <dd className="num font-semibold text-ink">{v.lots}</dd>
                </div>
                <div>
                  <dt className="text-muted">Miejsca</dt>
                  <dd className="num font-semibold text-ink">{v.spots}</dd>
                </div>
                <div>
                  <dt className="text-muted">Wolne</dt>
                  <dd className="num font-semibold text-ink">{v.greenfieldSpots}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </Section>

      {/* -------------------------------------------------------- playbook */}

      <Section
        title="Approach per segment"
        hint="Kto jest właścicielem decyduje o tym, co powiedzieć, kto podpisuje i czego się boją. Rozwiń segment, żeby zobaczyć pitch."
      >
        <div className="flex flex-col gap-2">
          {segments.map((s) => {
            const play = SEGMENT_PLAYBOOK[s.segment];
            return (
              <details
                key={s.segment}
                className="group rounded-card border border-line bg-surface shadow-card"
                open={play.tier === "A"}
              >
                <summary className="flex min-h-touch cursor-pointer list-none flex-wrap items-center gap-3 px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                  <Badge icon={TIER_ICON[play.tier]} tone={tierTone(play.tier)}>
                    {TIER_LABEL[play.tier]}
                  </Badge>
                  <span className="inline-flex items-center gap-2 font-display text-body font-bold text-ink">
                    <SegmentGlyph segment={s.segment} />
                    {play.label}
                  </span>
                  <span className="num text-ui text-muted">
                    {s.lots > 0 ? `${s.lots} placów · ${s.greenfieldSpots} wolnych miejsc` : "brak zmapowanych placów"}
                    {s.reconSites > 0 ? ` · ${s.reconSites} do rekonesansu` : ""}
                  </span>
                  {s.seasonGrossGr > 0 ? (
                    <span className="ml-auto shrink-0">
                      <Price gr={s.seasonGrossGr} size="sm" per="/sezon brutto" />
                    </span>
                  ) : null}
                </summary>

                <dl className="flex flex-col gap-3 border-t border-line px-4 py-3 text-ui">
                  <div>
                    <dt className="font-semibold text-ink">Dlaczego powiedzą tak</dt>
                    <dd className="text-muted">{play.why}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Pitch</dt>
                    <dd className="text-ink">„{play.pitch}”</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Największe ryzyko</dt>
                    <dd className="text-muted">{play.risk}</dd>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="font-semibold text-ink">Kto podpisuje</dt>
                      <dd className="text-muted">{play.decisionMaker}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Cykl</dt>
                      <dd className="text-muted">{play.cycle}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-ink">Kanał (legalny)</dt>
                      <dd className="text-muted">{play.channel}</dd>
                    </div>
                  </div>
                </dl>
              </details>
            );
          })}
        </div>
        <dl className="grid gap-2 text-ui sm:grid-cols-3">
          {(["A", "B", "C"] as const).map((tier) => (
            <div key={tier} className="flex flex-col gap-0.5">
              <dt className="font-semibold text-ink">{TIER_LABEL[tier]}</dt>
              <dd className="text-muted">{TIER_HINT[tier]}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ----------------------------------------------------------- table */}

      <Section
        title={`Zmapowane place (${sites.length} z ${CANDIDATE_SITES.length})`}
        hint="Pojemność „z OSM” pochodzi z tagu capacity. Każda inna to powierzchnia poligonu / 25 m² na miejsce — szacunek, nie pomiar."
      >
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1.5 text-ui font-semibold text-ink">
            Nazwa, właściciel, ulica
            <Input name="q" type="search" defaultValue={params.q ?? ""} placeholder="Bułgarska albo APCOA" />
          </label>

          <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
            Segment
            <Select name="segment" defaultValue={params.segment ?? ""}>
              <option value="">Wszystkie</option>
              {segments.map((s) => (
                <option key={s.segment} value={s.segment}>
                  {SEGMENT_PLAYBOOK[s.segment].label}
                </option>
              ))}
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
            Obiekt
            <Select name="venue" defaultValue={params.venue ?? ""}>
              <option value="">Oba</option>
              <option value="ENEA">Enea Stadion</option>
              <option value="MTP">MTP</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
            Priorytet
            <Select name="tier" defaultValue={params.tier ?? ""}>
              <option value="">Wszystkie</option>
              <option value="A">Idź w tym tygodniu</option>
              <option value="B">Kolejka</option>
              <option value="C">Tylko inbound</option>
            </Select>
          </label>

          <label className="flex flex-col gap-1.5 text-ui font-semibold text-ink">
            Podaż
            <Select name="supply" defaultValue={params.supply ?? ""}>
              <option value="">Wszystkie</option>
              <option value="green">Nikt nie sprzedaje</option>
              <option value="paid">Już płatne</option>
            </Select>
          </label>

          <Button type="submit" variant="quiet">
            Filtruj
          </Button>
        </form>

        {sites.length === 0 ? (
          <EmptyState
            title="Żaden plac nie pasuje do filtrów"
            description="Wyczyść wyszukiwanie albo poszerz priorytet — lista bazowa ma 73 pozycje."
          />
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th className="text-right">Ocena</Th>
                <Th>Obiekt</Th>
                <Th>Segment</Th>
                <Th className="text-right">Miejsca</Th>
                <Th>Dojście</Th>
                <Th className="text-right">Sezon brutto</Th>
                <Th>Stan placu</Th>
                <Th>Sprawdź</Th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => {
                const play = SEGMENT_PLAYBOOK[s.segment];
                return (
                  <tr key={s.osm}>
                    <Td className="text-right">
                      <span className="num font-display text-body font-bold text-ink">{s.score}</span>
                    </Td>

                    <Td>
                      <span className="font-semibold text-ink">
                        {s.name ?? s.ownerName ?? "Bez nazwy w OSM"}
                      </span>
                      <br />
                      <span className="text-ui text-muted">{addressOf(s)}</span>
                      {s.ownerName && s.ownerName !== s.name ? (
                        <>
                          <br />
                          <span className="text-ui text-muted">
                            właściciel: {s.ownerName} ({CONFIDENCE_LABEL[s.ownerConfidence]})
                          </span>
                        </>
                      ) : null}
                      {s.operator ? (
                        <>
                          <br />
                          <span className="text-ui text-muted">operator: {s.operator}</span>
                        </>
                      ) : null}
                    </Td>

                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <Badge icon={SEGMENT_ICON[s.segment]} tone={tierTone(play.tier)}>
                          {play.label}
                        </Badge>
                        {s.alreadyPaid ? (
                          <Badge icon={CircleDollarSign} tone="muted">
                            Już płatny
                          </Badge>
                        ) : null}
                        {s.venueOwned ? (
                          <Badge icon={Building2} tone="muted">
                            Własność obiektu
                          </Badge>
                        ) : null}
                      </div>
                    </Td>

                    <Td className="text-right">
                      <span className="num font-semibold text-ink">{s.spots}</span>
                      <br />
                      <span className="text-ui text-muted">{BASIS_LABEL[s.spotsBasis]}</span>
                      {s.areaM2 ? (
                        <>
                          <br />
                          <span className="num text-ui text-muted">{s.areaM2} m²</span>
                        </>
                      ) : null}
                    </Td>

                    <Td className="whitespace-nowrap text-muted">
                      {/* Straight line with the detour factor, never routed (CLAUDE.md). */}
                      <span className="num text-ink">
                        ok. {s.walkMinutes} min do {VENUE_LABEL[s.primaryVenue]}
                      </span>
                      <br />
                      <span className="num text-ui">{s.rateBand} · {Math.round(s.rateGr / 100)} zł/miejsce</span>
                      <br />
                      <span className="num text-ui">{s.events} wydarzeń</span>
                    </Td>

                    <Td className="text-right">
                      <Price gr={s.seasonGrossGr} size="sm" />
                      <br />
                      <span className="text-ui text-muted">przy 100% obłożenia</span>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {/* access=private is a POSITIVE signal here: a gated lot
                            sitting empty is exactly the product we want. */}
                        {s.access ? (
                          <Badge
                            icon={Lock}
                            tone={s.access === "private" || s.access === "customers" ? "ok" : "muted"}
                          >
                            {s.access}
                          </Badge>
                        ) : null}
                        {s.barrier ? (
                          <Badge icon={Lock} tone="ok">
                            {s.barrier}
                          </Badge>
                        ) : null}
                        {s.supervised === "yes" ? (
                          <Badge icon={Eye} tone="ok">
                            dozór
                          </Badge>
                        ) : null}
                        {s.lit === "yes" ? (
                          <Badge icon={Lightbulb} tone="muted">
                            oświetlony
                          </Badge>
                        ) : null}
                        {s.surface ? (
                          <Badge icon={Layers} tone="muted">
                            {s.surface}
                          </Badge>
                        ) : null}
                        {s.parkingKind ? (
                          <Badge icon={SquareParking} tone="muted">
                            {s.parkingKind}
                          </Badge>
                        ) : null}
                        {/* 1,9 m pod ziemią vs 2,1 m SUV-a — filtruj przed sprzedażą. */}
                        {s.maxheight ? (
                          <Badge icon={AlertTriangle} tone="bad">
                            max {s.maxheight} m
                          </Badge>
                        ) : null}
                      </div>
                    </Td>

                    <Td>
                      <div className="flex flex-col items-start gap-1 text-ui">
                        <a
                          href={satelliteUrl(s.point)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-ink underline underline-offset-4"
                        >
                          Satelita <ExternalLink size={12} aria-hidden="true" />
                        </a>
                        <a
                          href={osmUrl(s.osm)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-muted underline underline-offset-4"
                        >
                          OSM <ExternalLink size={12} aria-hidden="true" />
                        </a>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableScroll>
        )}
      </Section>

      {/* ----------------------------------------------------------- recon */}

      <Section
        title={`Właściciele bez zmapowanego placu (${RECON_SITES.length})`}
        hint="OSM nie mapuje prywatnych parkingów, a to są najlepsze cele. Świadomie bez liczby miejsc — obrys budynku to nie parking. Jedź, popatrz, czy jest ogrodzenie i szlaban."
      >
        <TableScroll>
          <thead>
            <tr>
              <Th>Obiekt</Th>
              <Th>Segment</Th>
              <Th className="text-right">Teren obiektu</Th>
              <Th>Dojście</Th>
              <Th>Sprawdź</Th>
            </tr>
          </thead>
          <tbody>
            {RECON_SITES.map((r) => {
              const play = SEGMENT_PLAYBOOK[r.segment];
              return (
                <tr key={r.osm}>
                  <Td>
                    <span className="font-semibold text-ink">{r.name ?? addressOf(r)}</span>
                    {r.name ? (
                      <>
                        <br />
                        <span className="text-ui text-muted">{addressOf(r)}</span>
                      </>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge icon={SEGMENT_ICON[r.segment]} tone={tierTone(play.tier)}>
                      {play.label}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <span className="num text-ink">{r.siteAreaM2} m²</span>
                    <br />
                    <span className="text-ui text-muted">teren, nie parking</span>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    <span className="num text-ink">
                      ok. {r.walkMinutes} min do {VENUE_LABEL[r.primaryVenue]}
                    </span>
                    <br />
                    <span className="num text-ui">
                      {r.rateBand} · {r.events} wydarzeń
                    </span>
                  </Td>
                  <Td>
                    <a
                      href={satelliteUrl(r.point)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-ui text-ink underline underline-offset-4"
                    >
                      Satelita <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableScroll>
      </Section>

      {/* ----------------------------------------------------- residential */}

      <Section
        title={`Zabudowa mieszkaniowa — odwrócony pitch (${RESIDENTIAL_CLUSTERS.length} ulic)`}
        hint="Spółdzielnia nie jest obiektem w OSM, więc jednostką jest ulica: idź tam i zdejmij nazwę administratora z tablicy ogłoszeń."
      >
        <Note title="Tu sprzedajesz koniec problemu, nie przychód">
          <p>
            Mieszkańcy okolic Bułgarskiej mają zastawiane podwórza w każdy dzień meczowy. To gotowa,
            wieloletnia frustracja — i jedyny segment, w którym <strong>rozwiązujesz ich
            problem</strong>, zamiast proponować dodatkowy zarobek.
          </p>
          <p>
            „W dniu meczu i tak stawiają Wam samochody na podwórzu. Możecie na tym zarabiać
            i decydować, kto wjeżdża — konkretna liczba miejsc, konkretne godziny, kod dla
            konkretnego kierowcy.”
          </p>
        </Note>

        <TableScroll>
          <thead>
            <tr>
              <Th>Ulica</Th>
              <Th className="text-right">Bloków w zasięgu</Th>
              <Th>Dojście</Th>
              <Th className="text-right">Stawka</Th>
              <Th>Sprawdź</Th>
            </tr>
          </thead>
          <tbody>
            {RESIDENTIAL_CLUSTERS.map((r) => (
              <tr key={r.street}>
                <Td>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                    <Home size={14} aria-hidden="true" /> {r.street}
                  </span>
                </Td>
                <Td className="text-right">
                  <span className="num font-semibold text-ink">{r.buildings}</span>
                </Td>
                <Td className="whitespace-nowrap text-muted">
                  <span className="num text-ink">
                    ok. {r.walkMinutes} min do {VENUE_LABEL[r.primaryVenue]}
                  </span>
                </Td>
                <Td className="text-right">
                  {r.rateGr ? (
                    <span className="num text-ink">{Math.round(r.rateGr / 100)} zł/miejsce</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                  <br />
                  <span className="text-ui text-muted">{r.rateBand}</span>
                </Td>
                <Td>
                  <a
                    href={satelliteUrl(r.point)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-ui text-ink underline underline-offset-4"
                  >
                    Satelita <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
      </Section>

      {/* ------------------------------------------------------ commission */}

      <Section
        title="Czy 30% od firmy i 50% od osoby prywatnej ma sens"
        hint={`Analiza stawek ${CURRENT.business}% od firm i ${CURRENT.individual}% od osób prywatnych, obowiązujących do 10.10.2026. Decyzja po niej: ${DECIDED.business}% dla wszystkich (commission_rules GLOBAL_*). Poniżej arytmetyka na pasach stawek z modules/leads/calc.`}
      >
        <Note tone="warn" title="Wniosek: wyższa stawka trafia w segment z lepszą alternatywą">
          <p>
            Osoba prywatna z podjazdem ma gotową opcję zastępczą — <strong>karton i gotówka</strong>.
            Firma jej nie ma: facility manager nie przyjmie banknotów przy szlabanie, bez faktury
            i bez ubezpieczenia. Wyższą prowizję bierze się od strony o <strong>słabszej</strong>
            pozycji, a my robimy odwrotnie: 50% od tego, kto może odejść w pięć minut, 30% od tego,
            kto nie może.
          </p>
        </Note>

        <TableScroll>
          <thead>
            <tr>
              <Th>Wariant hosta</Th>
              <Th className="text-right">Brutto / sezon</Th>
              <Th className="text-right">Dziś</Th>
              <Th className="text-right">Propozycja</Th>
              <Th className="text-right">Bez nas (gotówka)</Th>
              <Th className="text-right">Przewaga dziś</Th>
            </tr>
          </thead>
          <tbody>
            {SCENARIO_RESULTS.map((r) => (
              <tr key={r.scenario.key}>
                <Td>
                  <span className="font-semibold text-ink">{r.scenario.label}</span>
                  <br />
                  <span className="num text-ui text-muted">
                    {r.scenario.spots} miejsc · {Math.round(r.scenario.rateGr / 100)} zł ·{" "}
                    {r.scenario.events} wydarzeń
                  </span>
                  <br />
                  <span className="text-ui text-muted">{r.scenario.note}</span>
                </Td>
                <Td className="text-right">
                  <Price gr={r.grossGr} size="sm" />
                </Td>
                <Td className="text-right">
                  <Price gr={r.currentNetGr} size="sm" />
                  <br />
                  <span className="num text-ui text-muted">prowizja {r.currentPct}%</span>
                </Td>
                <Td className="text-right">
                  <Price gr={r.proposedNetGr} size="sm" />
                  <br />
                  <span className="num text-ui text-muted">prowizja {r.proposedPct}%</span>
                </Td>
                <Td className="text-right">
                  {r.outsideOptionGr == null ? (
                    <span className="text-ui text-muted">brak realnej opcji</span>
                  ) : (
                    <Price gr={r.outsideOptionGr} size="sm" />
                  )}
                </Td>
                <Td className="text-right">
                  {r.currentAdvantageGr == null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <span
                      className={
                        r.currentAdvantageGr <= 0
                          ? "num font-semibold text-danger"
                          : "num font-semibold text-ink"
                      }
                    >
                      {r.currentAdvantageGr > 0 ? "+" : ""}
                      {Math.round(r.currentAdvantageGr / 100)} zł
                    </span>
                  )}
                  {r.proposedAdvantageGr != null ? (
                    <>
                      <br />
                      <span className="num text-ui text-scan-ok">
                        propozycja: {r.proposedAdvantageGr > 0 ? "+" : ""}
                        {Math.round(r.proposedAdvantageGr / 100)} zł
                      </span>
                    </>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroll>
        <p className="text-ui text-muted">
          „Bez nas” liczy gotówkę przy 30 zł od miejsca i 75% obłożenia — realny wynik kartonu przy
          wjeździe, bez rezerwacji i bez gwarancji. Dla firm to pole jest puste świadomie: ich
          alternatywą jest nie robić nic, czyli zero.
        </p>

        <div className="grid gap-3 lg:grid-cols-2">
          {FINDINGS.map((f) => (
            <div
              key={f.title}
              className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <div className="flex items-start gap-2">
                <Badge icon={VERDICT_ICON[f.verdict]} tone={VERDICT_TONE[f.verdict]}>
                  {VERDICT_LABEL[f.verdict]}
                </Badge>
              </div>
              <h3 className="font-display text-body font-bold text-ink">{f.title}</h3>
              <p className="text-ui text-muted">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="rounded-card border border-line bg-surface-2 p-4">
          <h3 className="mb-3 font-display text-h3 font-bold text-ink">Proponowana siatka</h3>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RECOMMENDATION.map((r) => (
              <div key={r.label} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-3">
                <dt className="text-ui font-semibold text-muted">{r.label}</dt>
                <dd className="num font-display text-h2 font-bold text-ink">{r.value}</dd>
                <dd className="text-ui text-muted">{r.detail}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-ui text-muted">
            Zamiast {CURRENT.individual}% / {CURRENT.business}% → {PROPOSED.individual}% /{" "}
            {PROPOSED.business}%, z kohortą założycielską na 20%. Kierunek różnicy zostaje (osoba
            prywatna kosztuje więcej w obsłudze), znika jej rozmiar. Mechanizm już istnieje:
            nadpisania per-host w <code>/admin/prowizje</code>, bez migracji.
          </p>
        </div>
      </Section>

      {/* ----------------------------------------------------- methodology */}

      <Section title="Metodyka i czego ta lista NIE zawiera">
        <div className="grid gap-3 lg:grid-cols-2">
          <Note title="Skąd te liczby">
            <p>
              <strong>Źródło:</strong> OpenStreetMap przez Overpass, {SNAPSHOT_DATE}, promień{" "}
              {SEARCH_RADIUS_M} m od obu obiektów. Dane © OpenStreetMap contributors (ODbL).
            </p>
            <p>
              <strong>Pojemność:</strong> tag <code>capacity</code> tam, gdzie istnieje
              ({t.taggedCapacity} z {t.lots} placów). W pozostałych powierzchnia poligonu / 25 m² na
              miejsce. Kondygnacje liczone tylko przy <code>multi-storey</code> i{" "}
              <code>underground</code> z tagiem poziomów.
            </p>
            <p>
              <strong>Dojście:</strong> model aplikacji — linia prosta × 1,3, 80 m/min. To NIE jest
              routing pieszy i strona nigdzie nie twierdzi inaczej.
            </p>
            <p>
              <strong>Ocena:</strong> pieniądz na stole × skłonność segmentu × premia za ogrodzenie ×
              bliskość. Heurystyka do sortowania kolejki, nie prognoza.
            </p>
          </Note>

          <Note tone="warn" title="Trzy rzeczy, o których trzeba wiedzieć">
            <p>
              <strong>1. OSM nie mapuje prywatnych placów.</strong> Salony, parafie i podwórza
              spółdzielni prawie nie istnieją w tych danych — a to najlepiej konwertujące segmenty.
              Stąd druga i trzecia tabela. Prawdziwy rynek jest większy niż {t.lots} pozycji i
              znajdziesz go pieszo, nie zapytaniem.
            </p>
            <p>
              <strong>2. {Math.round((t.paidSpots / t.spots) * 100)}% zmapowanych miejsc już jest
              płatne</strong> ({formatSpots(t.paidSpots)} z {formatSpots(t.spots)}) — APCOA stoi
              przy samej Enei, Grupa MTP ma swoje. To konkurencja, która już tam jest, i osobna
              rozmowa: kanał sprzedaży na wydarzenia, których nie wypełniają.
            </p>
            <p>
              <strong>3. Ta strona nie pamięta, z kim rozmawiałeś.</strong> Dataset jest w repo, więc
              statusu „zadzwonione / odmowa / podpisane” nie da się tu zapisać. To wymaga tabeli w
              bazie i jest następnym krokiem, jeśli lista okaże się użyteczna w terenie.
            </p>
          </Note>
        </div>

        <Note title="Kanały, których wolno użyć">
          <p>
            <code>docs/LEGAL_RESEARCH.md</code> §2.2 zakazuje cold-mailingu i cold-SMS-a — art. 398
            PKE obejmuje też B2B, kara do 3% przychodu albo 1 mln zł. Zostaje:{" "}
            <strong>wizyta osobista, poczta tradycyjna, ulotka bezadresowa, post w lokalnej grupie
            (publikacja, nie mailing), prasa lokalna, obecność w dniu meczu, inbound z landingu.</strong>
          </p>
          <p>
            Najwyższą dźwignią w całym zestawie nie jest żaden wiersz z tabel: to{" "}
            <strong>jedna rozmowa z MTP</strong>. Mają własny problem z nadmiarem samochodów w dni
            targowe — rozwiązanie ich problemu kupuje wiarygodność, której nie da się kupić inaczej.
          </p>
        </Note>
      </Section>
    </div>
  );
}
