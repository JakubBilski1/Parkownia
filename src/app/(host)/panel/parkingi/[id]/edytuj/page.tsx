import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { WeeklySchedule } from "@/db/types";
import { ApiError } from "@/modules/parkings/errors";
import { getParkingForOwner, type OwnerParkingView } from "@/modules/parkings/service";
import { getSession } from "@/modules/parkings/session";
import { ParkingForm } from "../../_components/parking-form";
// Same rule as /panel/parkingi/nowy: the blank state comes from the plain module.
// This page only survived the old import because it overrode every single field.
import { EMPTY_FORM, type ParkingFormValues } from "../../_components/parking-form-values";

export const metadata: Metadata = { title: "Edytuj parking" };
export const dynamic = "force-dynamic";

/** Grosze back into what the host typed: 1250 -> "12,50", 3500 -> "35". */
function fromGrosze(gr: number | null): string {
  if (gr === null) return "";
  return gr % 100 === 0 ? String(gr / 100) : (gr / 100).toFixed(2).replace(".", ",");
}

function tri(value: boolean | null): "" | "true" | "false" {
  if (value === null) return "";
  return value ? "true" : "false";
}

function toFormValues(parking: OwnerParkingView): ParkingFormValues {
  const schedule: WeeklySchedule = parking.schedule ?? {};

  return {
    ...EMPTY_FORM,
    id: parking.id,
    status: parking.status,
    ownerType: parking.ownerType,
    title: parking.title ?? "",
    description: parking.description ?? "",
    address: parking.address ?? "",
    location: parking.location,
    capacity: parking.capacity === null ? "" : String(parking.capacity),
    pricePerHour: fromGrosze(parking.pricePerHourGr),
    pricePerDay: fromGrosze(parking.pricePerDayGr),
    pricePerEvent: fromGrosze(parking.pricePerEventGr),
    parkingType: parking.parkingType ?? "",
    accessType: parking.accessType ?? "",
    accessInstructions: parking.accessInstructions ?? "",
    entranceLocation: parking.entranceLocation,
    entranceNotes: parking.entranceNotes ?? "",
    surface: parking.surface ?? "",
    isCovered: tri(parking.isCovered),
    isGuarded: tri(parking.isGuarded),
    hasCctv: tri(parking.hasCctv),
    isLit: tri(parking.isLit),
    isFenced: tri(parking.isFenced),
    maxVehicleHeightCm:
      parking.maxVehicleHeightCm === null ? "" : String(parking.maxVehicleHeightCm),
    maxVehicleLengthCm:
      parking.maxVehicleLengthCm === null ? "" : String(parking.maxVehicleLengthCm),
    vehicleTypes: parking.vehicleTypes ?? [],
    hasEvCharging: parking.hasEvCharging ?? false,
    evConnectorTypes: parking.evConnectorTypes ?? [],
    hasDisabledAccess: parking.hasDisabledAccess ?? false,
    disabledSpotsCount:
      parking.disabledSpotsCount === null ? "" : String(parking.disabledSpotsCount),
    // MANUAL windows have no editor in the MVP; a parking already in that mode keeps
    // it (the resolver honours it) but the form never offers it as a choice.
    availabilityMode:
      parking.availabilityMode === "MANUAL" ? "ALWAYS" : parking.availabilityMode,
    schedule,
    minBookingMinutes: String(parking.minBookingMinutes),
    freeMinutes: String(parking.freeMinutes),
    payoutBankAccount: parking.payoutBankAccount ?? "",
    photos: parking.photos.map((photo) => ({
      id: photo.id,
      url: photo.url,
      width: photo.width,
      height: photo.height,
    })),
    profileCompleteness: parking.profileCompleteness,
  };
}

export default async function EditParkingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  const { id } = await params;

  if (!session) {
    redirect(`/logowanie?next=/panel/parkingi/${id}/edytuj`);
  }

  let parking: OwnerParkingView;
  try {
    parking = await getParkingForOwner(session, id);
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-ink">
          {parking.title ?? "Parking bez nazwy"}
        </h1>
        <p className="text-body text-muted">
          Zmiany zapisują się same. Nic nie przepadnie, jeśli zamkniesz kartę.
        </p>
      </header>

      <ParkingForm initial={toFormValues(parking)} />
    </div>
  );
}
