import type { PickerPoint } from "./location-picker";
import type { PhotoItem } from "./photo-manager";

/**
 * The form's shape and its blank state — and the reason they live in their own,
 * NON-"use client" module.
 *
 * `EMPTY_FORM` used to be exported from parking-form.tsx, which is a client
 * module. React replaces *every* export of a "use client" module with a client
 * reference, so a Server Component importing this constant did not get an object:
 * it got a proxy. `{ ...EMPTY_FORM }` then spread nothing, `values.title` was
 * undefined, validate() threw on `.trim()`, and /panel/parkingi/nowy answered with
 * the error boundary — every time, for everyone. A host could not add a parking at
 * all, which is the whole supply side of the marketplace.
 *
 * Types are erased at compile time, so importing them from client modules (the two
 * lines above) is free. Values are not. Keep values that a Server Component reads
 * out of client modules.
 */

export type Tri = "" | "true" | "false";

export type Slot = { from: string; to: string };
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Schedule = Partial<Record<DayKey, Slot[]>>;

export type ParkingFormValues = {
  id: string | null;
  status: string;
  ownerType: "INDIVIDUAL" | "BUSINESS";
  title: string;
  description: string;
  address: string;
  location: PickerPoint | null;
  capacity: string;
  pricePerHour: string;
  pricePerDay: string;
  pricePerEvent: string;
  parkingType: string;
  accessType: string;
  accessInstructions: string;
  entranceLocation: PickerPoint | null;
  entranceNotes: string;
  surface: string;
  isCovered: Tri;
  isGuarded: Tri;
  hasCctv: Tri;
  isLit: Tri;
  isFenced: Tri;
  maxVehicleHeightCm: string;
  maxVehicleLengthCm: string;
  vehicleTypes: string[];
  hasEvCharging: boolean;
  evConnectorTypes: string[];
  hasDisabledAccess: boolean;
  disabledSpotsCount: string;
  availabilityMode: "ALWAYS" | "RECURRING_SCHEDULE" | "EVENT_ONLY";
  schedule: Schedule;
  minBookingMinutes: string;
  freeMinutes: string;
  payoutBankAccount: string;
  photos: PhotoItem[];
  profileCompleteness: number;
};

export const EMPTY_FORM: ParkingFormValues = {
  id: null,
  status: "DRAFT",
  ownerType: "INDIVIDUAL",
  title: "",
  description: "",
  address: "",
  location: null,
  capacity: "",
  pricePerHour: "",
  pricePerDay: "",
  pricePerEvent: "",
  parkingType: "",
  accessType: "",
  accessInstructions: "",
  entranceLocation: null,
  entranceNotes: "",
  surface: "",
  isCovered: "",
  isGuarded: "",
  hasCctv: "",
  isLit: "",
  isFenced: "",
  maxVehicleHeightCm: "",
  maxVehicleLengthCm: "",
  vehicleTypes: [],
  hasEvCharging: false,
  evConnectorTypes: [],
  hasDisabledAccess: false,
  disabledSpotsCount: "",
  availabilityMode: "ALWAYS",
  schedule: {},
  minBookingMinutes: "30",
  freeMinutes: "0",
  payoutBankAccount: "",
  photos: [],
  profileCompleteness: 0,
};
