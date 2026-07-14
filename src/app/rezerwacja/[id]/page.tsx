import { ArrowLeft, Ruler, ShieldCheck, Umbrella } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { formatDatePL, formatHeight, formatTimeRangePL } from "@/lib/format";
import { DomainError } from "@/modules/bookings/errors";
import { eventBookingWindow, quotePrice } from "@/modules/bookings/pricing";
import { getCheckoutContext } from "@/modules/bookings/service";
import { eventSlug } from "@/modules/events/slug";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const QUARTER_MS = 15 * 60_000;
const HOUR_MS = 3_600_000;

const DURATIONS = [
  { hours: 2, label: "2 godz." },
  { hours: 4, label: "4 godz." },
  { hours: 24, label: "Doba" },
] as const;

function single(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  // The segment is a parking id here and a booking id one level down
  // (/rezerwacja/:id/potwierdzenie). Next.js requires one slug name per level,
  // so the folder is [id] and the meaning is fixed by depth.
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id: parkingId } = await params;
  const query = await searchParams;
  const eventId = single(query.eventId);
  const hours = Number(single(query.godziny) ?? 0) || 3;

  let context;
  try {
    context = await getCheckoutContext({ parkingId, eventId });
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  const { parking, event } = context;

  const window = event
    ? eventBookingWindow(event)
    : (() => {
        const start = new Date(Math.ceil(Date.now() / QUARTER_MS) * QUARTER_MS);
        return { startsAt: start, endsAt: new Date(start.getTime() + hours * HOUR_MS) };
      })();

  let priceGr: number | null = null;
  let priceError: string | null = null;
  try {
    priceGr = quotePrice({
      parking,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
      spots: 1,
      isEvent: Boolean(event),
    }).priceGr;
  } catch (error) {
    priceError =
      error instanceof DomainError
        ? error.message
        : "Nie umiemy policzyć ceny dla tego terminu.";
  }

  const features = [
    parking.isCovered ? { icon: Umbrella, label: "Zadaszony" } : null,
    parking.isGuarded ? { icon: ShieldCheck, label: "Strzeżony" } : null,
    parking.maxVehicleHeightCm
      ? { icon: Ruler, label: `Do ${formatHeight(parking.maxVehicleHeightCm)} wysokości` }
      : null,
  ].filter((item): item is { icon: typeof Umbrella; label: string } => item !== null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[32rem] flex-col gap-4 p-4 pb-8">
      {/* Back to the event's parking list, not to the event index — a driver who
          loses their event loses their sale. The slug is derived, not stored, so
          it is built with the events module's own helper. */}
      <Link
        href={event ? `/wydarzenia/${eventSlug(event)}` : "/"}
        className="inline-flex min-h-touch items-center gap-2 self-start text-ui font-semibold text-muted transition-colors duration-micro ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        Wróć do listy
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-extrabold text-ink">Rezerwacja</h1>
        <p className="text-body text-muted">
          Płacisz teraz, kod dostaniesz od razu po płatności.
        </p>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="font-display text-h3 font-bold text-ink">
                {parking.title ?? "Parking"}
              </h2>
              {parking.address ? (
                <p className="text-ui text-muted">{parking.address}</p>
              ) : null}
            </div>
            {priceGr !== null ? <Price gr={priceGr} size="lg" /> : null}
          </div>

          <dl className="flex flex-col gap-2 border-t border-line pt-3 text-body">
            {event ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Wydarzenie</dt>
                <dd className="text-right text-ink">
                  {event.title}
                  {event.venueName ? <span className="text-muted">, {event.venueName}</span> : null}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Kiedy</dt>
              <dd className="num text-right text-ink">
                {formatDatePL(window.startsAt)}, {formatTimeRangePL(window.startsAt, window.endsAt)}
              </dd>
            </div>
            {event ? (
              <p className="text-ui text-muted">
                Miejsce jest Twoje od dwóch godzin przed wydarzeniem do dwóch godzin po nim.
              </p>
            ) : null}
          </dl>

          {features.length > 0 ? (
            <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-3">
              {features.map((feature) => (
                <li key={feature.label} className="flex items-center gap-1.5 text-ui text-muted">
                  <feature.icon size={16} aria-hidden="true" />
                  {feature.label}
                </li>
              ))}
            </ul>
          ) : null}
        </CardBody>
      </Card>

      {!event ? (
        <nav aria-label="Czas postoju" className="flex flex-col gap-2">
          <span className="text-ui font-semibold text-muted">Czas postoju</span>
          <div className="flex gap-2">
            {DURATIONS.map((duration) => {
              const selected = duration.hours === hours;
              return (
                <Link
                  key={duration.hours}
                  href={`/rezerwacja/${parkingId}?godziny=${duration.hours}`}
                  aria-current={selected ? "true" : undefined}
                  scroll={false}
                  className={[
                    "press inline-flex min-h-touch flex-1 items-center justify-center rounded-pill border px-3 text-ui font-semibold",
                    "transition-colors duration-micro ease-out",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                    selected
                      ? "border-selected bg-selected text-selected-ink"
                      : "border-line bg-surface text-ink hover:bg-surface-2",
                  ].join(" ")}
                >
                  {duration.label}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}

      {priceGr === null ? (
        <Card>
          <CardBody className="flex flex-col gap-2">
            <h2 className="font-display text-h3 font-bold text-ink">Nie da się tego kupić</h2>
            <p className="text-body text-muted">{priceError}</p>
            <p className="text-body text-muted">Nie pobraliśmy żadnych pieniędzy.</p>
          </CardBody>
        </Card>
      ) : (
        <CheckoutForm
          parkingId={parkingId}
          eventId={event?.id ?? null}
          startsAt={window.startsAt.toISOString()}
          endsAt={window.endsAt.toISOString()}
          priceGr={priceGr}
        />
      )}
    </main>
  );
}
