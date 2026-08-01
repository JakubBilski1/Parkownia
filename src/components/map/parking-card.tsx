"use client";

import {
  ArrowUpRight,
  Camera,
  Lightbulb,
  Plug,
  Ruler,
  Shield,
  Umbrella,
  Accessibility,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, Button, Price } from "@/components/ui";
import { cn } from "@/lib/cn";
import {
  estimateWalk,
  formatHeight,
  formatSpots,
  formatWalkDistance,
  WALK_SPEED_M_PER_MIN,
} from "@/lib/format";
import type { ParkingDetail } from "./types";

const PARKING_TYPE_LABEL: Record<string, string> = {
  OUTDOOR_LOT: "Plac odkryty",
  UNDERGROUND: "Parking podziemny",
  GARAGE: "Garaż",
  DRIVEWAY: "Podjazd",
  STREET_ADJACENT: "Miejsce przy ulicy",
  MULTI_STOREY: "Parking wielopoziomowy",
};

const ACCESS_TYPE_LABEL: Record<string, string> = {
  OPEN: "Wjazd otwarty",
  BARRIER_CODE: "Szlaban otwierany na kod",
  BARRIER_REMOTE: "Szlaban na pilota",
  GATE_MANUAL: "Bramę otwiera właściciel",
  LPR: "Szlaban czyta tablice rejestracyjne",
  KEY_HANDOVER: "Klucz odbierasz na miejscu",
  ATTENDANT: "Na miejscu jest obsługa",
};

type Feature = { icon: LucideIcon; label: string };

function features(parking: ParkingDetail): Feature[] {
  const list: Feature[] = [];
  if (parking.isCovered) list.push({ icon: Umbrella, label: "Zadaszony" });
  if (parking.isGuarded) list.push({ icon: Shield, label: "Strzeżony" });
  if (parking.hasCctv) list.push({ icon: Camera, label: "Monitoring" });
  if (parking.isLit) list.push({ icon: Lightbulb, label: "Oświetlony" });
  if (parking.hasEvCharging) list.push({ icon: Plug, label: "Ładowarka EV" });
  if (parking.hasDisabledAccess)
    list.push({ icon: Accessibility, label: "Miejsce dla niepełnosprawnych" });
  return list;
}

/**
 * Two different numbers, and confusing them would lie to the driver: the server
 * already detours its estimate (API_SPEC §3: euclid × 1,3), while a distance we
 * measured in the browser is a raw straight line. Only the raw one gets the
 * detour factor applied, and neither is ever presented as a walked route.
 */
function walkLabel(parking: ParkingDetail, straightLineMeters: number | null): string | null {
  if (typeof parking.distanceMeters === "number") {
    const meters = parking.distanceMeters;
    const minutes = Math.max(1, Math.round(meters / WALK_SPEED_M_PER_MIN));
    const distance =
      meters < 1000
        ? `ok. ${Math.round(meters / 10) * 10} m`
        : `ok. ${(meters / 1000).toFixed(1).replace(".", ",")} km`;
    return `${distance} pieszo · ok. ${minutes} min`;
  }
  if (straightLineMeters === null) return null;
  return `${formatWalkDistance(straightLineMeters)} · ok. ${estimateWalk(straightLineMeters).minutes} min`;
}

export type ParkingCardProps = {
  parking: ParkingDetail;
  /** Raw straight-line metres measured in the browser, when there is a reference. */
  distanceMeters?: number | null;
  onReserve?: () => void;
  /** In a sheet the title and the CTA live in the chrome, not in the body. */
  variant?: "standalone" | "sheet";
  className?: string;
};

export function ParkingCard({
  parking,
  distanceMeters,
  onReserve,
  variant = "standalone",
  className,
}: ParkingCardProps) {
  const walk = walkLabel(parking, distanceMeters ?? null);
  const photos = parking.photos.slice(0, 10);
  const typeLabel = parking.parkingType
    ? PARKING_TYPE_LABEL[parking.parkingType]
    : undefined;
  const accessLabel = parking.accessType
    ? ACCESS_TYPE_LABEL[parking.accessType]
    : undefined;
  const hasDetails = Boolean(
    typeLabel || accessLabel || parking.maxVehicleHeightCm || parking.entranceNotes,
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {photos.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
          {photos.map((photo, index) => (
            <div
              key={photo.url}
              // The box is reserved before the bytes arrive: nothing below moves.
              className="aspect-[4/3] w-[15rem] shrink-0 snap-start overflow-hidden rounded-card border border-line bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={
                  index === 0
                    ? `Zdjęcie parkingu ${parking.title ?? ""}`.trim()
                    : ""
                }
                loading={index === 0 ? "eager" : "lazy"}
                decoding="async"
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex aspect-[4/3] max-h-40 items-center justify-center rounded-card border border-line bg-surface-2 text-ui text-muted">
          Host nie dodał jeszcze zdjęć
        </div>
      )}

      <div className="flex flex-col gap-1">
        {variant === "standalone" ? (
          <h3 className="font-display text-h3 font-bold text-ink">
            {parking.title ?? "Parking"}
          </h3>
        ) : null}
        {parking.address ? (
          <p className="text-body text-muted">{parking.address}</p>
        ) : null}
        {walk ? (
          <p className="num text-body text-muted">
            {walk}
            <span className="ml-1 text-ui">(w linii prostej, nie trasą)</span>
          </p>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between gap-4">
        {parking.priceGr === null ? (
          <p className="text-body text-muted">Host nie ustawił jeszcze ceny.</p>
        ) : (
          <Price gr={parking.priceGr} per={parking.priceUnit ?? undefined} size="lg" />
        )}
        {parking.capacity ? (
          <p className="num text-ui text-muted">{formatSpots(parking.capacity)}</p>
        ) : null}
      </div>

      {features(parking).length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {features(parking).map((feature) => (
            <li key={feature.label}>
              <Badge icon={feature.icon}>{feature.label}</Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The box is the frame around the rows, so it only exists when a row
          does. A host who filled in nothing beyond the five required fields —
          which the parking form explicitly invites — was getting an empty
          bordered rectangle under the price, reading as a broken component. */}
      {hasDetails ? (
        <dl className="flex flex-col gap-2 rounded-card border border-line bg-surface-2 p-3">
          {typeLabel ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ui text-muted">Rodzaj</dt>
              <dd className="text-ui text-ink">{typeLabel}</dd>
            </div>
          ) : null}
          {accessLabel ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ui text-muted">Wjazd</dt>
              <dd className="text-ui text-ink">{accessLabel}</dd>
            </div>
          ) : null}
          {parking.maxVehicleHeightCm ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-ui text-muted">
                <Ruler size={14} aria-hidden="true" />
                Maksymalna wysokość auta
              </dt>
              <dd className="num text-ui font-semibold text-ink">
                {formatHeight(parking.maxVehicleHeightCm)}
              </dd>
            </div>
          ) : null}
          {parking.entranceNotes ? (
            <div className="flex items-start justify-between gap-4">
              <dt className="text-ui text-muted">Dojazd</dt>
              <dd className="text-ui text-ink">{parking.entranceNotes}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {parking.description ? (
        <p className="text-body text-ink">{parking.description}</p>
      ) : null}

      <p className="text-ui text-muted">
        Dokładny adres wjazdu i kod do szlabanu dostaniesz po opłaceniu rezerwacji.
      </p>

      {variant === "standalone" && onReserve ? (
        <Button variant="accent" size="lg" block onClick={onReserve}>
          Zarezerwuj
        </Button>
      ) : null}
    </div>
  );
}

export type ParkingListItemProps = {
  parking: ParkingDetail;
  distanceMeters?: number | null;
  onOpen: () => void;
};

/** Compact row used in the "kilka parkingów w tym miejscu" list. */
export function ParkingListItem({
  parking,
  distanceMeters,
  onOpen,
}: ParkingListItemProps) {
  const walk = walkLabel(parking, distanceMeters ?? null);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "press flex min-h-touch w-full items-center justify-between gap-3 rounded-card border border-line bg-surface p-3 text-left",
        "transition-colors duration-micro ease-out hover:bg-surface-2",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-body font-semibold text-ink">
          {parking.title ?? "Parking"}
        </span>
        <span className="truncate text-ui text-muted">
          {walk ?? parking.address ?? ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {parking.priceGr !== null ? <Price gr={parking.priceGr} size="sm" /> : null}
        <ArrowUpRight size={16} aria-hidden="true" className="text-muted" />
      </span>
    </button>
  );
}
