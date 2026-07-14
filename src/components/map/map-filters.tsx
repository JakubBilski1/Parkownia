"use client";

import { Ruler, SlidersHorizontal, Umbrella, Shield } from "lucide-react";
import { useState } from "react";
import { Button, Chip, RadioGroup, Sheet, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  type MapFilters,
  type ParkingTypeFilter,
} from "./types";

/** One tap, one common decision: what a match-day space usually costs. */
const QUICK_PRICE_CAP_GR = 3000;
/** A 2,10 m SUV in front of a 1,90 m garage is the mistake this prevents. */
const QUICK_HEIGHT_CM = 210;

const PRICE_OPTIONS = [
  { value: "any", label: "Bez limitu" },
  { value: "2000", label: "Do 20 zł" },
  { value: "3000", label: "Do 30 zł" },
  { value: "4000", label: "Do 40 zł" },
  { value: "6000", label: "Do 60 zł" },
] as const;

const HEIGHT_OPTIONS = [
  { value: "any", label: "Bez znaczenia" },
  { value: "180", label: "1,80 m", hint: "Kompakt, hatchback" },
  { value: "200", label: "2,00 m", hint: "Kombi z bagażnikiem dachowym" },
  { value: "210", label: "2,10 m", hint: "SUV" },
  { value: "260", label: "2,60 m", hint: "Bus, kamper" },
] as const;

const PARKING_TYPES: ReadonlyArray<{ value: ParkingTypeFilter; label: string }> = [
  { value: "OUTDOOR_LOT", label: "Plac odkryty" },
  { value: "UNDERGROUND", label: "Podziemny" },
  { value: "GARAGE", label: "Garaż" },
  { value: "MULTI_STOREY", label: "Wielopoziomowy" },
  { value: "DRIVEWAY", label: "Podjazd" },
  { value: "STREET_ADJACENT", label: "Przy ulicy" },
];

export type MapFiltersProps = {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
  className?: string;
};

/**
 * Four filters are visible; everything else lives behind "Więcej filtrów".
 * A driver with eight minutes to kick-off does not read a filter panel — the
 * four here are the four that change which pin they tap (Hick).
 */
export function MapFiltersBar({ filters, onChange, className }: MapFiltersProps) {
  const [open, setOpen] = useState(false);
  const hidden =
    filters.parkingType.length +
    (filters.hasEvCharging ? 1 : 0) +
    (filters.hasDisabledAccess ? 1 : 0);

  const priceLabel = filters.maxPriceGr
    ? `Do ${formatMoney(filters.maxPriceGr)}`
    : `Do ${formatMoney(QUICK_PRICE_CAP_GR)}`;

  const heightLabel = filters.minHeightCm
    ? `Auto ${(filters.minHeightCm / 100).toFixed(2).replace(".", ",")} m`
    : "Wysokie auto";

  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      <Chip
        icon={Umbrella}
        selected={filters.isCovered}
        onClick={() => onChange({ ...filters, isCovered: !filters.isCovered })}
      >
        Zadaszony
      </Chip>

      <Chip
        icon={Shield}
        selected={filters.isGuarded}
        onClick={() => onChange({ ...filters, isGuarded: !filters.isGuarded })}
      >
        Strzeżony
      </Chip>

      <Chip
        selected={filters.maxPriceGr !== null}
        onClick={() =>
          onChange({
            ...filters,
            maxPriceGr: filters.maxPriceGr === null ? QUICK_PRICE_CAP_GR : null,
          })
        }
      >
        {priceLabel}
      </Chip>

      <Chip
        icon={Ruler}
        selected={filters.minHeightCm !== null}
        onClick={() =>
          onChange({
            ...filters,
            minHeightCm: filters.minHeightCm === null ? QUICK_HEIGHT_CM : null,
          })
        }
      >
        {heightLabel}
      </Chip>

      <Chip
        icon={SlidersHorizontal}
        selected={hidden > 0}
        count={hidden > 0 ? hidden : undefined}
        onClick={() => setOpen(true)}
      >
        Więcej filtrów
      </Chip>

      <MoreFiltersSheet
        open={open}
        onClose={() => setOpen(false)}
        filters={filters}
        onChange={onChange}
      />
    </div>
  );
}

function MoreFiltersSheet({
  open,
  onClose,
  filters,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
}) {
  const active = countActiveFilters(filters);

  const toggleType = (type: ParkingTypeFilter) => {
    const next = filters.parkingType.includes(type)
      ? filters.parkingType.filter((value) => value !== type)
      : [...filters.parkingType, type];
    onChange({ ...filters, parkingType: next });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filtry"
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => onChange(EMPTY_FILTERS)}>
            Wyczyść
          </Button>
          <Button variant="accent" block onClick={onClose}>
            Pokaż parkingi
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <RadioGroup
          name="maxPrice"
          legend="Cena maksymalna"
          value={filters.maxPriceGr === null ? "any" : String(filters.maxPriceGr)}
          options={PRICE_OPTIONS}
          onValueChange={(value) =>
            onChange({
              ...filters,
              maxPriceGr: value === "any" ? null : Number(value),
            })
          }
        />

        <RadioGroup
          name="vehicleHeight"
          legend="Wysokość Twojego auta"
          value={filters.minHeightCm === null ? "any" : String(filters.minHeightCm)}
          options={HEIGHT_OPTIONS}
          onValueChange={(value) =>
            onChange({
              ...filters,
              minHeightCm: value === "any" ? null : Number(value),
            })
          }
        />

        <fieldset>
          <legend className="mb-2 text-ui font-semibold text-muted">
            Rodzaj parkingu
          </legend>
          <div className="flex flex-wrap gap-2">
            {PARKING_TYPES.map((type) => (
              <Chip
                key={type.value}
                selected={filters.parkingType.includes(type.value)}
                onClick={() => toggleType(type.value)}
              >
                {type.label}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Switch
            label="Ładowarka do auta elektrycznego"
            checked={filters.hasEvCharging}
            onChange={(event) =>
              onChange({ ...filters, hasEvCharging: event.target.checked })
            }
          />
          <Switch
            label="Miejsce dla osób z niepełnosprawnością"
            checked={filters.hasDisabledAccess}
            onChange={(event) =>
              onChange({ ...filters, hasDisabledAccess: event.target.checked })
            }
          />
        </div>

        <p className="text-ui text-muted">
          {active === 0
            ? "Bez filtrów pokazujemy wszystkie wolne parkingi w widoku mapy."
            : `Wybrane filtry: ${active}. Pokazujemy tylko parkingi, które spełniają wszystkie.`}
        </p>
      </div>
    </Sheet>
  );
}
