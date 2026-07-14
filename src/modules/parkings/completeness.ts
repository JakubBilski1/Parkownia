import type { SelectParking } from "@/db/types";

export type CompletenessInput = Pick<
  SelectParking,
  | "title"
  | "description"
  | "location"
  | "address"
  | "capacity"
  | "parkingType"
  | "accessType"
  | "accessInstructions"
  | "entranceLocation"
  | "entranceNotes"
  | "surface"
  | "isCovered"
  | "isGuarded"
  | "hasCctv"
  | "isLit"
  | "isFenced"
  | "maxVehicleHeightCm"
  | "vehicleTypes"
  | "hasDisabledAccess"
  | "pricePerHourGr"
  | "pricePerDayGr"
  | "pricePerEventGr"
  | "payoutBankAccount"
> & { photoCount: number };

type Criterion = {
  key: string;
  /** Shown to the host as the next thing worth doing. Polish, active voice. */
  label: string;
  weight: number;
  met: (parking: CompletenessInput) => boolean;
};

const filled = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== "";

/**
 * Weights encode what a driver actually needs before trusting 35 zł to a stranger:
 * a photo and an entrance note are worth more than a checkbox. The five publication
 * requirements carry most of the score, so a publishable parking never scores low.
 */
const CRITERIA: readonly Criterion[] = [
  { key: "title", label: "Nazwa", weight: 8, met: (p) => filled(p.title) },
  { key: "location", label: "Lokalizacja na mapie", weight: 10, met: (p) => filled(p.location) },
  { key: "capacity", label: "Liczba miejsc", weight: 8, met: (p) => filled(p.capacity) },
  {
    key: "price",
    label: "Cena",
    weight: 10,
    met: (p) =>
      filled(p.pricePerHourGr) || filled(p.pricePerDayGr) || filled(p.pricePerEventGr),
  },
  {
    key: "photos",
    label: "Zdjęcia (min. 3)",
    weight: 14,
    met: (p) => p.photoCount >= 3,
  },
  { key: "photo1", label: "Pierwsze zdjęcie", weight: 6, met: (p) => p.photoCount >= 1 },
  {
    key: "entrance",
    label: "Punkt wjazdu",
    weight: 8,
    met: (p) => filled(p.entranceLocation),
  },
  {
    key: "entranceNotes",
    label: "Jak trafić do wjazdu",
    weight: 5,
    met: (p) => filled(p.entranceNotes),
  },
  { key: "address", label: "Adres", weight: 4, met: (p) => filled(p.address) },
  { key: "description", label: "Opis", weight: 5, met: (p) => filled(p.description) },
  { key: "parkingType", label: "Rodzaj parkingu", weight: 4, met: (p) => filled(p.parkingType) },
  { key: "accessType", label: "Sposób wjazdu", weight: 4, met: (p) => filled(p.accessType) },
  {
    key: "accessInstructions",
    label: "Instrukcja wjazdu dla kierowcy",
    weight: 4,
    met: (p) => filled(p.accessInstructions),
  },
  {
    key: "height",
    label: "Maksymalna wysokość pojazdu",
    weight: 4,
    met: (p) => filled(p.maxVehicleHeightCm),
  },
  {
    key: "vehicleTypes",
    label: "Jakie pojazdy przyjmujesz",
    weight: 3,
    met: (p) => (p.vehicleTypes?.length ?? 0) > 0,
  },
  {
    key: "amenities",
    label: "Udogodnienia (oświetlenie, monitoring, ochrona)",
    weight: 3,
    met: (p) =>
      [p.isCovered, p.isGuarded, p.hasCctv, p.isLit, p.isFenced].filter(filled).length >= 3,
  },
];

const TOTAL_WEIGHT = CRITERIA.reduce((sum, criterion) => sum + criterion.weight, 0);

export type CompletenessResult = {
  score: number;
  missing: Array<{ key: string; label: string; weight: number }>;
};

export function evaluateCompleteness(parking: CompletenessInput): CompletenessResult {
  let earned = 0;
  const missing: CompletenessResult["missing"] = [];

  for (const criterion of CRITERIA) {
    if (criterion.met(parking)) {
      earned += criterion.weight;
    } else {
      missing.push({ key: criterion.key, label: criterion.label, weight: criterion.weight });
    }
  }

  const score = Math.round((earned / TOTAL_WEIGHT) * 100);

  // Heaviest gap first: the host sees the one change that moves the number most.
  missing.sort((a, b) => b.weight - a.weight);

  return { score: Math.min(100, Math.max(0, score)), missing };
}

export function completenessScore(parking: CompletenessInput): number {
  return evaluateCompleteness(parking).score;
}
