import { createHash } from "node:crypto";
import { hash as argon2Hash } from "@node-rs/argon2";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import type { Point } from "./geo";
import {
  businessProfiles,
  commissionRules,
  events,
  parkings,
  refundPolicies,
  userRoles,
  users,
  venues,
} from "./schema";
import type { InsertEvent, InsertParking, Role } from "./types";

// Deterministic ids keep the seed idempotent without needing a natural key on
// every table: re-running produces the same uuids, so ON CONFLICT DO NOTHING wins.
function seedId(namespace: string, key: string): string {
  const h = createHash("sha256").update(`parkspot:${namespace}:${key}`).digest("hex");
  const bytes = h.slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = "a";
  const hex = bytes.join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

const RULES_VALID_FROM = new Date("2026-01-01T00:00:00Z");

const ENEA = {
  id: seedId("venue", "enea-stadion"),
  name: "Enea Stadion",
  address: "ul. Bułgarska 17, Poznań",
  location: { lat: 52.3977, lng: 16.8581 } satisfies Point,
  capacity: 43269,
};

const MTP = {
  id: seedId("venue", "mtp"),
  name: "Międzynarodowe Targi Poznańskie",
  address: "ul. Głogowska 14, Poznań",
  location: { lat: 52.4022, lng: 16.9128 } satisfies Point,
  capacity: null,
};

// All timestamps UTC. Kick-off 20:00 Europe/Warsaw = 18:00Z under CEST and
// 19:00Z after DST ends (2026-10-25). Fairs run 09:00–17:00 local, same shift.
const MATCHES: Array<{ opponent: string; startsAt: string }> = [
  { opponent: "Cracovia", startsAt: "2026-07-25T18:00:00Z" },
  { opponent: "Piast Gliwice", startsAt: "2026-08-08T18:00:00Z" },
  { opponent: "Jagiellonia Białystok", startsAt: "2026-08-22T18:00:00Z" },
  { opponent: "Raków Częstochowa", startsAt: "2026-09-05T18:00:00Z" },
  { opponent: "Radomiak Radom", startsAt: "2026-09-19T18:00:00Z" },
  { opponent: "Korona Kielce", startsAt: "2026-10-17T18:00:00Z" },
  { opponent: "Wisła Kraków", startsAt: "2026-10-31T19:00:00Z" },
  { opponent: "Zagłębie Lubin", startsAt: "2026-11-07T19:00:00Z" },
  { opponent: "Pogoń Szczecin", startsAt: "2026-11-28T19:00:00Z" },
];

const MATCH_DURATION_MS = 2 * 60 * 60 * 1000;

const FAIRS: Array<{
  title: string;
  startsAt: string;
  endsAt: string;
  category: InsertEvent["category"];
}> = [
  {
    title: "DREMA",
    startsAt: "2026-09-08T07:00:00Z",
    endsAt: "2026-09-11T15:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Retro Motor Show",
    startsAt: "2026-09-18T07:00:00Z",
    endsAt: "2026-09-20T15:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Polagra",
    startsAt: "2026-09-23T07:00:00Z",
    endsAt: "2026-09-25T15:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Poznań Maraton",
    startsAt: "2026-10-04T07:00:00Z",
    endsAt: "2026-10-04T13:00:00Z",
    category: "SPORTS",
  },
  {
    title: "Caravans Salon",
    startsAt: "2026-10-08T07:00:00Z",
    endsAt: "2026-10-11T15:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Tour Salon",
    startsAt: "2026-10-09T07:00:00Z",
    endsAt: "2026-10-11T15:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Poznań Game Arena",
    startsAt: "2026-11-13T08:00:00Z",
    endsAt: "2026-11-15T16:00:00Z",
    category: "TRADE_FAIR",
  },
  {
    title: "Cavaliada",
    startsAt: "2026-12-10T08:00:00Z",
    endsAt: "2026-12-13T16:00:00Z",
    category: "SPORTS",
  },
];

async function seedVenues(): Promise<void> {
  await db
    .insert(venues)
    .values([
      {
        id: ENEA.id,
        name: ENEA.name,
        address: ENEA.address,
        location: ENEA.location,
        capacity: ENEA.capacity,
      },
      {
        id: MTP.id,
        name: MTP.name,
        address: MTP.address,
        location: MTP.location,
        capacity: MTP.capacity,
      },
    ])
    .onConflictDoNothing({ target: venues.id });
}

async function seedEvents(): Promise<number> {
  const rows: InsertEvent[] = [];

  for (const match of MATCHES) {
    const title = `Lech Poznań – ${match.opponent}`;
    rows.push({
      id: seedId("event", `${ENEA.id}:${title}:${match.startsAt}`),
      venueId: ENEA.id,
      title,
      startsAt: new Date(match.startsAt),
      endsAt: new Date(new Date(match.startsAt).getTime() + MATCH_DURATION_MS),
      category: "FOOTBALL",
      searchRadiusMeters: 1500,
    });
  }

  for (const fair of FAIRS) {
    rows.push({
      id: seedId("event", `${MTP.id}:${fair.title}:${fair.startsAt}`),
      venueId: MTP.id,
      title: fair.title,
      startsAt: new Date(fair.startsAt),
      endsAt: new Date(fair.endsAt),
      category: fair.category,
      searchRadiusMeters: 1500,
    });
  }

  await db.insert(events).values(rows).onConflictDoNothing({ target: events.id });
  return rows.length;
}

async function seedCommissionRules(): Promise<void> {
  await db
    .insert(commissionRules)
    .values([
      {
        id: seedId("commission", "GLOBAL_INDIVIDUAL"),
        scope: "GLOBAL_INDIVIDUAL",
        ratePct: 50,
        validFrom: RULES_VALID_FROM,
      },
      {
        id: seedId("commission", "GLOBAL_BUSINESS"),
        scope: "GLOBAL_BUSINESS",
        ratePct: 30,
        validFrom: RULES_VALID_FROM,
      },
    ])
    .onConflictDoNothing({ target: commissionRules.id });
}

async function seedRefundPolicy(): Promise<void> {
  await db
    .insert(refundPolicies)
    .values({
      id: seedId("refund-policy", "default-v1"),
      name: "Standardowa polityka zwrotów",
      rules: [
        { minHoursBefore: 24, refundPct: 100 },
        { minHoursBefore: 2, refundPct: 50 },
        { minHoursBefore: 0, refundPct: 0 },
      ],
      isDefault: true,
      validFrom: RULES_VALID_FROM,
    })
    .onConflictDoNothing({ target: refundPolicies.id });
}

/* -------------------------------------------------------------------------- */
/* Dev fixtures — only behind SEED_DEV=1                                      */
/* -------------------------------------------------------------------------- */

type DevAccount = {
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
};

const DEV_ACCOUNTS: DevAccount[] = [
  { email: "admin@parkspot.pl", firstName: "Ada", lastName: "Admin", roles: ["ADMIN", "DRIVER"] },
  {
    email: "host@parkspot.pl",
    firstName: "Hanna",
    lastName: "Hostowska",
    roles: ["HOST_INDIVIDUAL", "DRIVER"],
  },
  {
    email: "firma@parkspot.pl",
    firstName: "Filip",
    lastName: "Firmowy",
    roles: ["HOST_BUSINESS", "DRIVER"],
  },
  {
    email: "kierowca@parkspot.pl",
    firstName: "Kamil",
    lastName: "Kierowca",
    roles: ["DRIVER"],
  },
];

type DevParking = Omit<InsertParking, "id" | "ownerId" | "ownerType"> & {
  key: string;
  owner: "host@parkspot.pl" | "firma@parkspot.pl";
};

// Scattered around both venues: 100–1300 m out, mixed types, prices, heights
// and availability modes so map filters and the height guard have real data.
const DEV_PARKINGS: DevParking[] = [
  {
    key: "enea-bulgarska-plac",
    owner: "firma@parkspot.pl",
    title: "Plac przy Bułgarskiej",
    address: "ul. Bułgarska 20, Poznań",
    location: { lat: 52.3969, lng: 16.8604 },
    entranceLocation: { lat: 52.3966, lng: 16.861 },
    entranceNotes: "Wjazd od Bułgarskiej, za stacją paliw.",
    capacity: 60,
    parkingType: "OUTDOOR_LOT",
    accessType: "ATTENDANT",
    accessInstructions: "Podaj kod obsłudze przy wjeździe.",
    surface: "ASPHALT",
    isCovered: false,
    isGuarded: true,
    hasCctv: true,
    isLit: true,
    isFenced: true,
    vehicleTypes: ["CAR", "SUV", "VAN"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 3500,
    pricePerHourGr: 900,
    status: "ACTIVE",
    profileCompleteness: 92,
  },
  {
    key: "enea-garaz-podziemny",
    owner: "firma@parkspot.pl",
    title: "Garaż podziemny Grunwald",
    address: "ul. Ptasia 10, Poznań",
    location: { lat: 52.3995, lng: 16.8642 },
    entranceLocation: { lat: 52.3998, lng: 16.8645 },
    entranceNotes: "Zjazd od Ptasiej, brama nr 2.",
    capacity: 40,
    parkingType: "UNDERGROUND",
    accessType: "BARRIER_CODE",
    accessInstructions: "Kod do szlabanu: 4417#.",
    surface: "CONCRETE",
    isCovered: true,
    isGuarded: false,
    hasCctv: true,
    isLit: true,
    maxVehicleHeightCm: 190,
    vehicleTypes: ["CAR"],
    availabilityMode: "ALWAYS",
    pricePerHourGr: 1200,
    pricePerDayGr: 5000,
    pricePerEventGr: 4000,
    status: "ACTIVE",
    profileCompleteness: 88,
  },
  {
    key: "enea-podjazd-marcelin",
    owner: "host@parkspot.pl",
    title: "Podjazd na Marcelinie",
    address: "ul. Marcelińska 88, Poznań",
    location: { lat: 52.4029, lng: 16.8598 },
    entranceLocation: { lat: 52.4029, lng: 16.8601 },
    capacity: 2,
    parkingType: "DRIVEWAY",
    accessType: "KEY_HANDOVER",
    accessInstructions: "Zadzwoń domofonem 12, wydam pilota.",
    surface: "PAVING",
    isCovered: false,
    isFenced: true,
    vehicleTypes: ["CAR", "SUV"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 3000,
    status: "ACTIVE",
    profileCompleteness: 70,
  },
  {
    key: "enea-trawnik-junikowo",
    owner: "host@parkspot.pl",
    title: "Trawiasty plac przy Junikowskiej",
    address: "ul. Junikowska 5, Poznań",
    location: { lat: 52.3931, lng: 16.8523 },
    entranceLocation: { lat: 52.3929, lng: 16.8527 },
    capacity: 25,
    parkingType: "OUTDOOR_LOT",
    accessType: "GATE_MANUAL",
    accessInstructions: "Bramę otwiera obsługa od 2 godzin przed meczem.",
    surface: "GRASS",
    isCovered: false,
    isLit: false,
    vehicleTypes: ["CAR", "SUV", "CAMPER"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 2500,
    status: "ACTIVE",
    profileCompleteness: 64,
  },
  {
    key: "enea-parking-firmowy",
    owner: "firma@parkspot.pl",
    title: "Parking firmowy po godzinach",
    address: "ul. Grunwaldzka 186, Poznań",
    location: { lat: 52.4004, lng: 16.8672 },
    entranceLocation: { lat: 52.4002, lng: 16.8676 },
    entranceNotes: "Wjazd od podwórza, nie od Grunwaldzkiej.",
    capacity: 35,
    parkingType: "OUTDOOR_LOT",
    accessType: "BARRIER_REMOTE",
    accessInstructions: "Szlaban otwiera się po zeskanowaniu kodu.",
    surface: "ASPHALT",
    isGuarded: false,
    hasCctv: true,
    isLit: true,
    isFenced: true,
    vehicleTypes: ["CAR", "SUV", "VAN"],
    hasDisabledAccess: true,
    disabledSpotsCount: 2,
    availabilityMode: "RECURRING_SCHEDULE",
    schedule: {
      mon: [{ from: "17:00", to: "24:00" }],
      tue: [{ from: "17:00", to: "24:00" }],
      wed: [{ from: "17:00", to: "24:00" }],
      thu: [{ from: "17:00", to: "24:00" }],
      fri: [{ from: "16:00", to: "24:00" }],
      sat: [{ from: "00:00", to: "24:00" }],
      sun: [{ from: "00:00", to: "24:00" }],
    },
    pricePerHourGr: 700,
    pricePerDayGr: 3500,
    pricePerEventGr: 3000,
    status: "ACTIVE",
    profileCompleteness: 95,
  },
  {
    key: "enea-wielopoziomowy",
    owner: "firma@parkspot.pl",
    title: "Parking wielopoziomowy Bułgarska",
    address: "ul. Bułgarska 55, Poznań",
    location: { lat: 52.3946, lng: 16.8556 },
    entranceLocation: { lat: 52.3944, lng: 16.8562 },
    capacity: 120,
    parkingType: "MULTI_STOREY",
    accessType: "LPR",
    accessInstructions: "Wjazd na tablicę rejestracyjną podaną w rezerwacji.",
    surface: "CONCRETE",
    isCovered: true,
    hasCctv: true,
    isLit: true,
    maxVehicleHeightCm: 210,
    vehicleTypes: ["CAR", "SUV", "VAN"],
    hasEvCharging: true,
    evConnectorTypes: ["TYPE2", "CCS"],
    hasDisabledAccess: true,
    disabledSpotsCount: 6,
    availabilityMode: "ALWAYS",
    pricePerHourGr: 1000,
    pricePerDayGr: 4500,
    pricePerEventGr: 3800,
    status: "ACTIVE",
    profileCompleteness: 100,
  },
  {
    key: "enea-garaz-blokowy",
    owner: "host@parkspot.pl",
    title: "Garaż przy bloku, 600 m od stadionu",
    address: "ul. Wojskowa 4, Poznań",
    location: { lat: 52.3939, lng: 16.8631 },
    entranceLocation: { lat: 52.3938, lng: 16.8634 },
    capacity: 1,
    parkingType: "GARAGE",
    accessType: "KEY_HANDOVER",
    accessInstructions: "Klucz w skrytce przy bramie, kod 7781.",
    surface: "CONCRETE",
    isCovered: true,
    maxVehicleHeightCm: 200,
    vehicleTypes: ["CAR", "MOTORCYCLE"],
    availabilityMode: "MANUAL",
    pricePerHourGr: 800,
    pricePerEventGr: 3200,
    status: "ACTIVE",
    profileCompleteness: 61,
  },
  {
    key: "enea-przy-ulicy",
    owner: "host@parkspot.pl",
    title: "Miejsce przy posesji, Świerzawska",
    address: "ul. Świerzawska 3, Poznań",
    location: { lat: 52.4013, lng: 16.8712 },
    entranceLocation: { lat: 52.4013, lng: 16.8715 },
    capacity: 3,
    parkingType: "STREET_ADJACENT",
    accessType: "OPEN",
    surface: "PAVING",
    isLit: true,
    vehicleTypes: ["CAR", "SUV", "MOTORCYCLE"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 2000,
    status: "ACTIVE",
    profileCompleteness: 55,
  },
  {
    key: "enea-kampery",
    owner: "firma@parkspot.pl",
    title: "Plac dla kamperów przy Bułgarskiej",
    address: "ul. Bułgarska 120, Poznań",
    location: { lat: 52.3902, lng: 16.8592 },
    entranceLocation: { lat: 52.3901, lng: 16.8598 },
    capacity: 15,
    parkingType: "OUTDOOR_LOT",
    accessType: "ATTENDANT",
    accessInstructions: "Obsługa wskazuje miejsce, kod przy wjeździe.",
    surface: "GRAVEL",
    isFenced: true,
    isLit: true,
    maxVehicleLengthCm: 900,
    vehicleTypes: ["CAMPER", "VAN", "TRAILER", "CAR"],
    availabilityMode: "ALWAYS",
    pricePerDayGr: 8000,
    pricePerEventGr: 6000,
    status: "ACTIVE",
    profileCompleteness: 78,
  },
  {
    key: "enea-do-moderacji",
    owner: "host@parkspot.pl",
    title: "Podwórko przy Ceglanej",
    address: "ul. Ceglana 8, Poznań",
    location: { lat: 52.3958, lng: 16.8668 },
    capacity: 4,
    parkingType: "DRIVEWAY",
    accessType: "OPEN",
    surface: "DIRT",
    vehicleTypes: ["CAR"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 1800,
    status: "PENDING_REVIEW",
    profileCompleteness: 48,
  },
  {
    key: "mtp-glogowska-plac",
    owner: "firma@parkspot.pl",
    title: "Plac przy Głogowskiej",
    address: "ul. Głogowska 26, Poznań",
    location: { lat: 52.4001, lng: 16.9095 },
    entranceLocation: { lat: 52.4, lng: 16.91 },
    entranceNotes: "Wjazd od Górczyńskiej, nie od Głogowskiej.",
    capacity: 50,
    parkingType: "OUTDOOR_LOT",
    accessType: "BARRIER_CODE",
    accessInstructions: "Kod do szlabanu: 2201#.",
    surface: "ASPHALT",
    isGuarded: true,
    hasCctv: true,
    isLit: true,
    isFenced: true,
    vehicleTypes: ["CAR", "SUV", "VAN"],
    availabilityMode: "ALWAYS",
    pricePerHourGr: 1100,
    pricePerDayGr: 5500,
    pricePerEventGr: 4200,
    status: "ACTIVE",
    profileCompleteness: 96,
  },
  {
    key: "mtp-garaz-hotel",
    owner: "firma@parkspot.pl",
    title: "Garaż podziemny pod hotelem",
    address: "ul. Roosevelta 20, Poznań",
    location: { lat: 52.4068, lng: 16.9134 },
    entranceLocation: { lat: 52.4071, lng: 16.9137 },
    capacity: 30,
    parkingType: "UNDERGROUND",
    accessType: "BARRIER_REMOTE",
    accessInstructions: "Zgłoś się w recepcji, kod z rezerwacji.",
    surface: "CONCRETE",
    isCovered: true,
    isGuarded: true,
    hasCctv: true,
    isLit: true,
    maxVehicleHeightCm: 185,
    vehicleTypes: ["CAR"],
    hasEvCharging: true,
    evConnectorTypes: ["TYPE2"],
    availabilityMode: "ALWAYS",
    pricePerHourGr: 1500,
    pricePerDayGr: 7000,
    pricePerEventGr: 5000,
    status: "ACTIVE",
    profileCompleteness: 90,
  },
  {
    key: "mtp-lazarz-podworko",
    owner: "host@parkspot.pl",
    title: "Podwórko na Łazarzu",
    address: "ul. Kolejowa 15, Poznań",
    location: { lat: 52.3993, lng: 16.9042 },
    entranceLocation: { lat: 52.3992, lng: 16.9046 },
    capacity: 5,
    parkingType: "DRIVEWAY",
    accessType: "GATE_MANUAL",
    accessInstructions: "Bramę otwiera gospodarz, dzwoń domofonem 3.",
    surface: "PAVING",
    isFenced: true,
    isLit: true,
    vehicleTypes: ["CAR", "SUV"],
    availabilityMode: "MANUAL",
    pricePerHourGr: 600,
    pricePerDayGr: 3000,
    pricePerEventGr: 2800,
    status: "ACTIVE",
    profileCompleteness: 66,
  },
  {
    key: "mtp-wielopoziomowy",
    owner: "firma@parkspot.pl",
    title: "Parking wielopoziomowy Święty Marcin",
    address: "ul. Święty Marcin 60, Poznań",
    location: { lat: 52.4083, lng: 16.9186 },
    entranceLocation: { lat: 52.4085, lng: 16.919 },
    capacity: 200,
    parkingType: "MULTI_STOREY",
    accessType: "LPR",
    accessInstructions: "Wjazd na tablicę rejestracyjną z rezerwacji.",
    surface: "CONCRETE",
    isCovered: true,
    hasCctv: true,
    isLit: true,
    maxVehicleHeightCm: 205,
    vehicleTypes: ["CAR", "SUV", "VAN", "MOTORCYCLE"],
    hasEvCharging: true,
    evConnectorTypes: ["TYPE2", "CCS", "CHADEMO"],
    hasDisabledAccess: true,
    disabledSpotsCount: 8,
    availabilityMode: "ALWAYS",
    pricePerHourGr: 1300,
    pricePerDayGr: 6500,
    pricePerEventGr: 4800,
    status: "ACTIVE",
    profileCompleteness: 100,
  },
  {
    key: "mtp-gorczyn-plac",
    owner: "host@parkspot.pl",
    title: "Plac przy Górczyńskiej",
    address: "ul. Górczyńska 12, Poznań",
    location: { lat: 52.3968, lng: 16.9066 },
    entranceLocation: { lat: 52.3967, lng: 16.907 },
    capacity: 18,
    parkingType: "OUTDOOR_LOT",
    accessType: "OPEN",
    surface: "GRAVEL",
    isLit: false,
    vehicleTypes: ["CAR", "SUV", "VAN"],
    availabilityMode: "RECURRING_SCHEDULE",
    schedule: {
      mon: [{ from: "07:00", to: "19:00" }],
      tue: [{ from: "07:00", to: "19:00" }],
      wed: [{ from: "07:00", to: "19:00" }],
      thu: [{ from: "07:00", to: "19:00" }],
      fri: [{ from: "07:00", to: "19:00" }],
    },
    pricePerHourGr: 500,
    pricePerDayGr: 2500,
    status: "ACTIVE",
    profileCompleteness: 58,
  },
  {
    key: "mtp-garaz-wilda",
    owner: "host@parkspot.pl",
    title: "Garaż na Wildzie",
    address: "ul. Wierzbięcice 40, Poznań",
    location: { lat: 52.3986, lng: 16.9214 },
    entranceLocation: { lat: 52.3985, lng: 16.9218 },
    capacity: 1,
    parkingType: "GARAGE",
    accessType: "KEY_HANDOVER",
    accessInstructions: "Pilot do odbioru pod adresem, mieszkanie 7.",
    surface: "CONCRETE",
    isCovered: true,
    maxVehicleHeightCm: 195,
    vehicleTypes: ["CAR", "MOTORCYCLE"],
    availabilityMode: "MANUAL",
    pricePerDayGr: 4000,
    status: "ACTIVE",
    profileCompleteness: 52,
  },
  {
    key: "mtp-motocykle",
    owner: "firma@parkspot.pl",
    title: "Miejsca dla motocykli przy MTP",
    address: "ul. Śniadeckich 3, Poznań",
    location: { lat: 52.4038, lng: 16.9075 },
    entranceLocation: { lat: 52.4037, lng: 16.9079 },
    capacity: 12,
    parkingType: "OUTDOOR_LOT",
    accessType: "ATTENDANT",
    accessInstructions: "Kod pokaż obsłudze, miejsce wskazane na miejscu.",
    surface: "ASPHALT",
    isGuarded: true,
    isLit: true,
    vehicleTypes: ["MOTORCYCLE", "BICYCLE"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 1500,
    status: "ACTIVE",
    profileCompleteness: 74,
  },
  {
    key: "mtp-do-moderacji",
    owner: "firma@parkspot.pl",
    title: "Plac po dawnej hurtowni",
    address: "ul. Kolejowa 45, Poznań",
    location: { lat: 52.3975, lng: 16.9018 },
    capacity: 22,
    parkingType: "OUTDOOR_LOT",
    accessType: "GATE_MANUAL",
    surface: "GRAVEL",
    vehicleTypes: ["CAR", "VAN"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 2600,
    status: "PENDING_REVIEW",
    profileCompleteness: 45,
  },
  {
    key: "mtp-wstrzymany",
    owner: "host@parkspot.pl",
    title: "Miejsce przy Matejki (chwilowo wstrzymane)",
    address: "ul. Matejki 50, Poznań",
    location: { lat: 52.4025, lng: 16.9052 },
    entranceLocation: { lat: 52.4024, lng: 16.9056 },
    capacity: 2,
    parkingType: "STREET_ADJACENT",
    accessType: "OPEN",
    surface: "PAVING",
    vehicleTypes: ["CAR"],
    availabilityMode: "EVENT_ONLY",
    pricePerEventGr: 2200,
    status: "PAUSED",
    profileCompleteness: 60,
  },
  {
    key: "mtp-szkic",
    owner: "host@parkspot.pl",
    title: "Nowy parking (szkic)",
    location: { lat: 52.4051, lng: 16.9101 },
    capacity: 6,
    availabilityMode: "EVENT_ONLY",
    status: "DRAFT",
    profileCompleteness: 20,
  },
];

async function seedDevFixtures(): Promise<{ users: number; parkings: number }> {
  // Dev-only credential. Never referenced outside this SEED_DEV=1 branch.
  const devPasswordHash = await argon2Hash("parkspot123");

  const accountIds = new Map<string, string>();
  for (const account of DEV_ACCOUNTS) {
    accountIds.set(account.email, seedId("user", account.email));
  }

  await db
    .insert(users)
    .values(
      DEV_ACCOUNTS.map((account) => ({
        id: accountIds.get(account.email)!,
        email: account.email,
        firstName: account.firstName,
        lastName: account.lastName,
        passwordHash: devPasswordHash,
        emailVerifiedAt: new Date(),
      })),
    )
    .onConflictDoNothing({ target: users.id });

  await db
    .insert(userRoles)
    .values(
      DEV_ACCOUNTS.flatMap((account) =>
        account.roles.map((role) => ({
          userId: accountIds.get(account.email)!,
          role,
        })),
      ),
    )
    .onConflictDoNothing();

  const companyUserId = accountIds.get("firma@parkspot.pl")!;
  await db
    .insert(businessProfiles)
    .values({
      userId: companyUserId,
      nip: "7781456789",
      companyName: "ParkSpot Testowa sp. z o.o.",
      address: "ul. Głogowska 14, 60-734 Poznań",
      vatStatus: "Czynny",
    })
    .onConflictDoNothing({ target: businessProfiles.userId });

  const parkingRows: InsertParking[] = DEV_PARKINGS.map((parking) => {
    const { key, owner, ...rest } = parking;
    return {
      ...rest,
      id: seedId("parking", key),
      ownerId: accountIds.get(owner)!,
      ownerType: owner === "firma@parkspot.pl" ? "BUSINESS" : "INDIVIDUAL",
    };
  });

  await db.insert(parkings).values(parkingRows).onConflictDoNothing({ target: parkings.id });

  return { users: DEV_ACCOUNTS.length, parkings: parkingRows.length };
}

export async function seed(): Promise<void> {
  await seedVenues();
  const eventCount = await seedEvents();
  await seedCommissionRules();
  await seedRefundPolicy();

  console.log(`Seeded 2 venues, ${eventCount} events, 2 commission rules, 1 refund policy.`);

  if (process.env.SEED_DEV === "1") {
    const dev = await seedDevFixtures();
    console.log(`Seeded dev fixtures: ${dev.users} accounts, ${dev.parkings} parkings.`);
  } else {
    console.log("SEED_DEV != 1 — skipping dev accounts and test parkings.");
  }

  const [venueCount] = await db.select({ count: sql<number>`count(*)::int` }).from(venues);
  const [activeParkings] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(parkings)
    .where(eq(parkings.status, "ACTIVE"));

  console.log(
    `Database now holds ${venueCount?.count ?? 0} venues and ${activeParkings?.count ?? 0} active parkings.`,
  );
}
