"use client";

import { Check, CloudOff, Plus, RefreshCw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  Checkbox,
  Field,
  Input,
  Progress,
  RadioGroup,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { formatTimePL } from "@/lib/format";
import { LocationPicker } from "./location-picker";
import { PhotoManager } from "./photo-manager";
import {
  type DayKey,
  type ParkingFormValues,
  type Schedule,
  type Slot,
  type Tri,
} from "./parking-form-values";

/* -------------------------------------------------------------------------- */
/* Shape                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * EMPTY_FORM is deliberately NOT re-exported from here. A re-export out of a
 * "use client" module is still a client reference, so a Server Component would
 * get the same proxy that broke /panel/parkingi/nowy. The pages import it from
 * ./parking-form-values directly, and there is no second way to do it.
 */

const DAYS: ReadonlyArray<{ key: DayKey; label: string }> = [
  { key: "mon", label: "Poniedziałek" },
  { key: "tue", label: "Wtorek" },
  { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" },
  { key: "fri", label: "Piątek" },
  { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

const PARKING_TYPES: ReadonlyArray<[string, string]> = [
  ["OUTDOOR_LOT", "Plac odkryty"],
  ["UNDERGROUND", "Parking podziemny"],
  ["GARAGE", "Garaż"],
  ["DRIVEWAY", "Podjazd przy domu"],
  ["STREET_ADJACENT", "Miejsce przy ulicy"],
  ["MULTI_STOREY", "Parking wielopoziomowy"],
];

const ACCESS_TYPES: ReadonlyArray<[string, string]> = [
  ["OPEN", "Wjazd otwarty"],
  ["BARRIER_CODE", "Szlaban otwierany na kod"],
  ["BARRIER_REMOTE", "Szlaban na pilota"],
  ["GATE_MANUAL", "Brama otwierana ręcznie"],
  ["LPR", "Automat czyta tablice rejestracyjne"],
  ["KEY_HANDOVER", "Przekazanie klucza"],
  ["ATTENDANT", "Na miejscu jest obsługa"],
];

const SURFACES: ReadonlyArray<[string, string]> = [
  ["ASPHALT", "Asfalt"],
  ["PAVING", "Kostka brukowa"],
  ["CONCRETE", "Beton"],
  ["GRAVEL", "Żwir"],
  ["GRASS", "Trawa"],
  ["DIRT", "Klepisko"],
];

const VEHICLE_TYPES: ReadonlyArray<[string, string]> = [
  ["CAR", "Osobowe"],
  ["SUV", "SUV"],
  ["VAN", "Dostawcze"],
  ["MOTORCYCLE", "Motocykle"],
  ["CAMPER", "Kampery"],
  ["TRAILER", "Przyczepy"],
  ["BICYCLE", "Rowery"],
];

const EV_CONNECTORS: ReadonlyArray<[string, string]> = [
  ["TYPE2", "Type 2"],
  ["CCS", "CCS"],
  ["CHADEMO", "CHAdeMO"],
  ["SCHUKO", "Gniazdko 230 V"],
];

/* -------------------------------------------------------------------------- */
/* Parsing and validation — the same limits the server enforces in Zod        */
/* -------------------------------------------------------------------------- */

/** "12,50" and "12.50" both mean 1250 grosze. Money never becomes a float. */
function toGrosze(input: string): number | null {
  const trimmed = input.trim().replace(",", ".");
  if (!trimmed) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

function toInt(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return Number(trimmed);
}

type Errors = Partial<Record<keyof ParkingFormValues | "price", string>>;

function validate(values: ParkingFormValues): Errors {
  const errors: Errors = {};

  if (values.title.trim() && values.title.trim().length < 3) {
    errors.title = "Nazwa musi mieć co najmniej 3 znaki.";
  }

  if (values.capacity.trim()) {
    const capacity = toInt(values.capacity);
    if (capacity === null || capacity < 1 || capacity > 5000) {
      errors.capacity = "Podaj liczbę miejsc od 1 do 5000.";
    }
  }

  for (const key of ["pricePerHour", "pricePerDay", "pricePerEvent"] as const) {
    const raw = values[key];
    if (raw.trim() && toGrosze(raw) === null) {
      errors[key] = "Kwota w złotych, np. 15 albo 12,50.";
    }
  }

  if (values.maxVehicleHeightCm.trim()) {
    const height = toInt(values.maxVehicleHeightCm);
    if (height === null || height < 100 || height > 600) {
      errors.maxVehicleHeightCm = "Wysokość w centymetrach, od 100 do 600 (np. 190).";
    }
  }

  if (values.maxVehicleLengthCm.trim()) {
    const length = toInt(values.maxVehicleLengthCm);
    if (length === null || length < 200 || length > 2500) {
      errors.maxVehicleLengthCm = "Długość w centymetrach, od 200 do 2500.";
    }
  }

  if (values.disabledSpotsCount.trim() && toInt(values.disabledSpotsCount) === null) {
    errors.disabledSpotsCount = "Podaj liczbę miejsc.";
  }

  if (values.minBookingMinutes.trim()) {
    const minutes = toInt(values.minBookingMinutes);
    if (minutes === null || minutes < 15 || minutes > 1440) {
      errors.minBookingMinutes = "Od 15 do 1440 minut.";
    }
  }

  if (values.freeMinutes.trim()) {
    const minutes = toInt(values.freeMinutes);
    if (minutes === null || minutes > 240) {
      errors.freeMinutes = "Od 0 do 240 minut.";
    }
  }

  const iban = values.payoutBankAccount.replace(/\s/g, "").toUpperCase();
  if (iban && !/^PL\d{26}$/.test(iban)) {
    errors.payoutBankAccount = "Numer konta: PL i 26 cyfr.";
  }

  return errors;
}

/** The five things without which nobody can buy a spot here. */
function missingRequired(values: ParkingFormValues): Errors {
  const errors: Errors = {};

  if (!values.title.trim()) errors.title = "Podaj nazwę parkingu.";
  if (!values.location) errors.location = "Wskaż parking na mapie.";
  if (!values.capacity.trim()) errors.capacity = "Podaj liczbę miejsc.";
  if (
    !values.pricePerHour.trim() &&
    !values.pricePerDay.trim() &&
    !values.pricePerEvent.trim()
  ) {
    errors.price = "Ustaw przynajmniej jedną cenę.";
  }
  if (
    values.availabilityMode === "RECURRING_SCHEDULE" &&
    DAYS.every(({ key }) => (values.schedule[key]?.length ?? 0) === 0)
  ) {
    errors.schedule = "Zaznacz godziny, w których parking jest dostępny.";
  }

  return errors;
}

function tri(value: Tri): boolean | null {
  return value === "" ? null : value === "true";
}

type Payload = Record<string, unknown>;

/**
 * Only fields that currently hold a valid value are sent. A half-typed price must
 * not make the autosave fail — the draft saves what is already good and waits for
 * the rest.
 */
function buildPayload(values: ParkingFormValues, errors: Errors): Payload {
  const payload: Payload = {
    ownerType: values.ownerType,
    availabilityMode: values.availabilityMode,
  };

  const put = (key: string, value: unknown) => {
    payload[key] = value;
  };

  if (values.title.trim() && !errors.title) put("title", values.title.trim());
  if (values.location) put("location", values.location);
  if (!errors.capacity) {
    const capacity = toInt(values.capacity);
    if (capacity !== null) put("capacity", capacity);
  }

  put("description", values.description.trim() || null);
  put("address", values.address.trim() || null);
  put("parkingType", values.parkingType || null);
  put("accessType", values.accessType || null);
  put("accessInstructions", values.accessInstructions.trim() || null);
  put("entranceLocation", values.entranceLocation ?? null);
  put("entranceNotes", values.entranceNotes.trim() || null);
  put("surface", values.surface || null);
  put("isCovered", tri(values.isCovered));
  put("isGuarded", tri(values.isGuarded));
  put("hasCctv", tri(values.hasCctv));
  put("isLit", tri(values.isLit));
  put("isFenced", tri(values.isFenced));
  put("vehicleTypes", values.vehicleTypes);
  put("hasEvCharging", values.hasEvCharging);
  put("evConnectorTypes", values.hasEvCharging ? values.evConnectorTypes : []);
  put("hasDisabledAccess", values.hasDisabledAccess);

  if (!errors.maxVehicleHeightCm) {
    put("maxVehicleHeightCm", toInt(values.maxVehicleHeightCm));
  }
  if (!errors.maxVehicleLengthCm) {
    put("maxVehicleLengthCm", toInt(values.maxVehicleLengthCm));
  }
  if (!errors.disabledSpotsCount) {
    put("disabledSpotsCount", values.hasDisabledAccess ? toInt(values.disabledSpotsCount) : null);
  }
  if (!errors.pricePerHour) put("pricePerHourGr", toGrosze(values.pricePerHour));
  if (!errors.pricePerDay) put("pricePerDayGr", toGrosze(values.pricePerDay));
  if (!errors.pricePerEvent) put("pricePerEventGr", toGrosze(values.pricePerEvent));

  if (!errors.minBookingMinutes) {
    const minutes = toInt(values.minBookingMinutes);
    if (minutes !== null) put("minBookingMinutes", minutes);
  }
  if (!errors.freeMinutes) {
    const minutes = toInt(values.freeMinutes);
    if (minutes !== null) put("freeMinutes", minutes);
  }

  if (!errors.payoutBankAccount) {
    const iban = values.payoutBankAccount.replace(/\s/g, "").toUpperCase();
    put("payoutBankAccount", iban || null);
  }

  const schedule: Schedule = {};
  for (const { key } of DAYS) {
    const slots = (values.schedule[key] ?? []).filter((slot) => slot.from && slot.to);
    if (slots.length > 0) schedule[key] = slots;
  }
  put("schedule", Object.keys(schedule).length > 0 ? schedule : null);

  return payload;
}

/* -------------------------------------------------------------------------- */
/* Form                                                                       */
/* -------------------------------------------------------------------------- */

type SaveState = "idle" | "saving" | "saved" | "error";

export type ParkingFormProps = {
  initial: ParkingFormValues;
};

export function ParkingForm({ initial }: ParkingFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [values, setValues] = useState<ParkingFormValues>(initial);
  const [showMore, setShowMore] = useState(initial.id !== null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [completeness, setCompleteness] = useState(initial.profileCompleteness);

  const idRef = useRef<string | null>(initial.id);
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const errors = useMemo(() => validate(values), [values]);
  const isPublished = values.status === "ACTIVE" || values.status === "PAUSED";

  const save = useCallback(async (keepalive = false): Promise<string | null> => {
    const current = valuesRef.current;
    const currentErrors = validate(current);
    const payload = buildPayload(current, currentErrors);

    // Nothing worth a row yet: an empty draft is noise in the host's list.
    if (!idRef.current && !current.title.trim() && !current.location) {
      return null;
    }

    setSaveState("saving");

    try {
      const id = idRef.current;
      const response = await fetch(id ? `/api/parkings/${id}` : "/api/parkings", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive,
      });

      if (!response.ok) {
        setSaveState("error");
        return null;
      }

      const saved: { id: string; profileCompleteness: number; status: string } =
        await response.json();

      if (!idRef.current) {
        idRef.current = saved.id;
        setValues((previous) => ({ ...previous, id: saved.id }));
        // Keeps the tab reloadable straight into the draft without remounting the
        // form (and without losing what is being typed right now).
        window.history.replaceState(null, "", `/panel/parkingi/${saved.id}/edytuj`);
      }

      setCompleteness(saved.profileCompleteness);
      setSaveState("saved");
      setSavedAt(new Date());
      dirtyRef.current = false;
      return saved.id;
    } catch {
      setSaveState("error");
      return null;
    }
  }, []);

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void save(), 1200);
  }, [save]);

  // Closing the tab must not cost the host what they typed.
  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      void save(true);
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });

    return () => {
      window.removeEventListener("pagehide", flush);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [save]);

  function set<K extends keyof ParkingFormValues>(key: K, value: ParkingFormValues[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    scheduleSave();
  }

  function toggleInList(key: "vehicleTypes" | "evConnectorTypes", value: string) {
    setValues((previous) => {
      const list = previous[key];
      const next = list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value];
      return { ...previous, [key]: next };
    });
    scheduleSave();
  }

  function setSlot(day: DayKey, index: number, patch: Partial<Slot>) {
    setValues((previous) => {
      const slots = [...(previous.schedule[day] ?? [])];
      const existing = slots[index] ?? { from: "", to: "" };
      slots[index] = { ...existing, ...patch };
      return { ...previous, schedule: { ...previous.schedule, [day]: slots } };
    });
    scheduleSave();
  }

  function addSlot(day: DayKey) {
    setValues((previous) => {
      const slots = [...(previous.schedule[day] ?? []), { from: "17:00", to: "23:00" }];
      return { ...previous, schedule: { ...previous.schedule, [day]: slots.slice(0, 2) } };
    });
    scheduleSave();
  }

  function removeSlot(day: DayKey, index: number) {
    setValues((previous) => {
      const slots = (previous.schedule[day] ?? []).filter((_, i) => i !== index);
      return { ...previous, schedule: { ...previous.schedule, [day]: slots } };
    });
    scheduleSave();
  }

  async function submit() {
    const missing = missingRequired(values);
    const blocking = { ...errors, ...missing };

    if (Object.keys(blocking).length > 0) {
      setSubmitErrors(blocking);
      setShowMore(true);
      toast({
        tone: "error",
        message: "Nie wysłaliśmy parkingu do sprawdzenia.",
        detail: "Brakuje pól oznaczonych na czerwono. Nic nie przepadło — szkic jest zapisany.",
      });
      return;
    }

    setSubmitting(true);
    setSubmitErrors({});

    try {
      const id = (await save()) ?? idRef.current;
      if (!id) {
        toast({
          tone: "error",
          message: "Nie zapisaliśmy parkingu.",
          detail: "Sprawdź połączenie i spróbuj ponownie.",
        });
        return;
      }

      if (isPublished) {
        toast({ tone: "ok", message: "Zapisaliśmy zmiany." });
        router.push("/panel/parkingi");
        router.refresh();
        return;
      }

      const response = await fetch(`/api/parkings/${id}/submit`, { method: "POST" });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const details: Array<{ field: string; message: string }> = payload?.error?.details ?? [];

        const mapped: Errors = {};
        for (const detail of details) {
          const key = detail.field === "price" ? "price" : (detail.field as keyof ParkingFormValues);
          mapped[key] = detail.message;
        }

        setSubmitErrors(mapped);
        toast({
          tone: "error",
          message: payload?.error?.message ?? "Nie wysłaliśmy parkingu do sprawdzenia.",
          detail: "Szkic jest zapisany — uzupełnij brakujące pola i spróbuj ponownie.",
        });
        return;
      }

      toast({
        tone: "ok",
        message: "Parking czeka na sprawdzenie.",
        detail: "Zwykle trwa to do 24 godzin. Napiszemy, gdy będzie w sprzedaży.",
      });
      router.push("/panel/parkingi");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const fieldError = (key: keyof Errors) => errors[key] ?? submitErrors[key];

  return (
    <form
      className="flex flex-col gap-4 pb-28"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <SaveIndicator state={saveState} savedAt={savedAt} onRetry={() => void save()} />

      {/* --- The five fields. Everything else is optional and folded away. --- */}
      <Card>
        <CardHeader>
          <CardTitle>Podstawy</CardTitle>
          <CardMeta>Pięć rzeczy, bez których nikt nie kupi miejsca. Reszta może poczekać.</CardMeta>
        </CardHeader>
        <CardBody className="flex flex-col gap-5">
          <Field label="Nazwa parkingu" required error={fieldError("title")}
            hint="Tak, jak rozpozna je kierowca: „Podwórko przy Bułgarskiej 30”.">
            {(props) => (
              <Input
                {...props}
                value={values.title}
                onChange={(event) => set("title", event.target.value)}
                autoComplete="off"
                maxLength={120}
              />
            )}
          </Field>

          <RadioGroup
            name="ownerType"
            legend="Wystawiasz parking"
            value={values.ownerType}
            onValueChange={(value) => set("ownerType", value)}
            options={[
              { value: "INDIVIDUAL", label: "Prywatnie", hint: "Jako osoba fizyczna." },
              { value: "BUSINESS", label: "Jako firma", hint: "Wymaga danych firmy (NIP) na koncie." },
            ]}
          />

          <Field
            label="Gdzie jest parking"
            required
            error={fieldError("location")}
            hint="Kliknij mapę albo znajdź adres. Pinezka może stanąć na środku placu — wjazd ustawisz osobno."
          >
            {() => (
              <LocationPicker
                value={values.location}
                onChange={(point) => set("location", point)}
                onAddress={(address) => set("address", address)}
                contextPoint={values.entranceLocation}
                contextLabel="Wjazd"
                searchable
                hint="Pinezka to środek parkingu."
              />
            )}
          </Field>

          <Field label="Adres" error={fieldError("address")}>
            {(props) => (
              <Input
                {...props}
                value={values.address}
                onChange={(event) => set("address", event.target.value)}
                autoComplete="street-address"
              />
            )}
          </Field>

          <Field
            label="Liczba miejsc"
            required
            error={fieldError("capacity")}
            hint="Ile aut zmieści się jednocześnie."
          >
            {(props) => (
              <Input
                {...props}
                value={values.capacity}
                onChange={(event) => set("capacity", event.target.value)}
                inputMode="numeric"
                autoComplete="off"
              />
            )}
          </Field>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-ui font-semibold text-ink">
              Cena <span className="text-muted">*</span>
            </legend>
            <p className="text-ui text-muted">
              Wystarczy jedna. Na mecz Lecha ludzie płacą zwykle 20–40 zł za wydarzenie.
            </p>

            <div className="grid grid-cols-1 gap-3 xs:grid-cols-3">
              <Field label="Za godzinę" error={fieldError("pricePerHour")}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.pricePerHour}
                    onChange={(event) => set("pricePerHour", event.target.value)}
                    inputMode="decimal"
                    suffix="zł"
                  />
                )}
              </Field>
              <Field label="Za dobę" error={fieldError("pricePerDay")}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.pricePerDay}
                    onChange={(event) => set("pricePerDay", event.target.value)}
                    inputMode="decimal"
                    suffix="zł"
                  />
                )}
              </Field>
              <Field label="Za wydarzenie" error={fieldError("pricePerEvent")}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.pricePerEvent}
                    onChange={(event) => set("pricePerEvent", event.target.value)}
                    inputMode="decimal"
                    suffix="zł"
                  />
                )}
              </Field>
            </div>

            {fieldError("price") ? (
              <p role="alert" className="text-ui text-danger">
                {fieldError("price")}
              </p>
            ) : null}
          </fieldset>
        </CardBody>
      </Card>

      {!showMore ? (
        <Button onClick={() => setShowMore(true)} block size="lg">
          <Plus size={18} aria-hidden="true" />
          Dodaj więcej szczegółów (opcjonalnie)
        </Button>
      ) : null}

      {showMore ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Zdjęcia</CardTitle>
              <CardMeta>Parkingi ze zdjęciami sprzedają się częściej niż te bez.</CardMeta>
            </CardHeader>
            <CardBody>
              <PhotoManager
                parkingId={values.id}
                photos={values.photos}
                onChange={(photos) => {
                  setValues((previous) => ({ ...previous, photos }));
                  void save();
                }}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wjazd</CardTitle>
              <CardMeta>
                Nawigacja prowadzi kierowcę tutaj, nie na środek placu. To najczęstszy powód
                spóźnienia pod stadionem.
              </CardMeta>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <Field label="Punkt wjazdu na mapie">
                {() => (
                  <LocationPicker
                    value={values.entranceLocation}
                    onChange={(point) => set("entranceLocation", point)}
                    contextPoint={values.location}
                    contextLabel="Parking"
                    tone="ink"
                    hint="Postaw pinezkę tam, gdzie auto zjeżdża z ulicy."
                  />
                )}
              </Field>

              <Field
                label="Jak trafić do wjazdu"
                hint="Napisz to, czego nie widać na mapie."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={values.entranceNotes}
                    onChange={(event) => set("entranceNotes", event.target.value)}
                    rows={3}
                    placeholder="Wjazd od ul. Górczyńskiej, nie od Głogowskiej. Brama za sklepem."
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wjazd i dostęp</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <Field label="Sposób wjazdu">
                {(props) => (
                  <Select
                    {...props}
                    value={values.accessType}
                    onChange={(event) => set("accessType", event.target.value)}
                  >
                    <option value="">Nie podano</option>
                    {ACCESS_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label="Instrukcja wjazdu"
                hint="Kod, numer do obsługi, sposób otwarcia bramy. Kierowca zobaczy to dopiero po opłaceniu rezerwacji."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={values.accessInstructions}
                    onChange={(event) => set("accessInstructions", event.target.value)}
                    rows={3}
                    placeholder="Kod do szlabanu: 4471. Po wjeździe zaparkuj przy ścianie po lewej."
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Parking</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <Field label="Rodzaj">
                {(props) => (
                  <Select
                    {...props}
                    value={values.parkingType}
                    onChange={(event) => set("parkingType", event.target.value)}
                  >
                    <option value="">Nie podano</option>
                    {PARKING_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field label="Nawierzchnia">
                {(props) => (
                  <Select
                    {...props}
                    value={values.surface}
                    onChange={(event) => set("surface", event.target.value)}
                  >
                    <option value="">Nie podano</option>
                    {SURFACES.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <TriField
                  label="Zadaszony"
                  value={values.isCovered}
                  onChange={(value) => set("isCovered", value)}
                />
                <TriField
                  label="Ochrona na miejscu"
                  value={values.isGuarded}
                  onChange={(value) => set("isGuarded", value)}
                />
                <TriField
                  label="Monitoring"
                  value={values.hasCctv}
                  onChange={(value) => set("hasCctv", value)}
                />
                <TriField
                  label="Oświetlenie"
                  value={values.isLit}
                  onChange={(value) => set("isLit", value)}
                />
                <TriField
                  label="Ogrodzenie"
                  value={values.isFenced}
                  onChange={(value) => set("isFenced", value)}
                />
              </div>

              <Field
                label="Opis"
                hint="Co kierowca powinien wiedzieć, zanim zapłaci."
              >
                {(props) => (
                  <Textarea
                    {...props}
                    value={values.description}
                    onChange={(event) => set("description", event.target.value)}
                    maxLength={4000}
                  />
                )}
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pojazdy</CardTitle>
              <CardMeta>
                Kierowca SUV-a nie może kupić miejsca w garażu o 20 cm za niskim. Podaj wysokość,
                a odfiltrujemy go zawczasu.
              </CardMeta>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <Field
                  label="Maksymalna wysokość"
                  error={fieldError("maxVehicleHeightCm")}
                  hint="W centymetrach, np. 190."
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={values.maxVehicleHeightCm}
                      onChange={(event) => set("maxVehicleHeightCm", event.target.value)}
                      inputMode="numeric"
                      suffix="cm"
                    />
                  )}
                </Field>

                <Field
                  label="Maksymalna długość"
                  error={fieldError("maxVehicleLengthCm")}
                  hint="Dla kamperów, np. 700."
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={values.maxVehicleLengthCm}
                      onChange={(event) => set("maxVehicleLengthCm", event.target.value)}
                      inputMode="numeric"
                      suffix="cm"
                    />
                  )}
                </Field>
              </div>

              <fieldset>
                <legend className="mb-2 text-ui font-semibold text-ink">
                  Jakie pojazdy przyjmujesz
                </legend>
                <div className="flex flex-col gap-1">
                  {VEHICLE_TYPES.map(([value, label]) => (
                    <Checkbox
                      key={value}
                      label={label}
                      checked={values.vehicleTypes.includes(value)}
                      onChange={() => toggleInList("vehicleTypes", value)}
                    />
                  ))}
                </div>
              </fieldset>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Udogodnienia</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <Checkbox
                label="Ładowarka do auta elektrycznego"
                checked={values.hasEvCharging}
                onChange={(event) => set("hasEvCharging", event.target.checked)}
              />

              {values.hasEvCharging ? (
                <fieldset className="pl-9">
                  <legend className="mb-2 text-ui font-semibold text-ink">Złącza</legend>
                  <div className="flex flex-col gap-1">
                    {EV_CONNECTORS.map(([value, label]) => (
                      <Checkbox
                        key={value}
                        label={label}
                        checked={values.evConnectorTypes.includes(value)}
                        onChange={() => toggleInList("evConnectorTypes", value)}
                      />
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <Checkbox
                label="Miejsce dla osób z niepełnosprawnością"
                checked={values.hasDisabledAccess}
                onChange={(event) => set("hasDisabledAccess", event.target.checked)}
              />

              {values.hasDisabledAccess ? (
                <Field
                  label="Ile takich miejsc"
                  error={fieldError("disabledSpotsCount")}
                  className="pl-9"
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={values.disabledSpotsCount}
                      onChange={(event) => set("disabledSpotsCount", event.target.value)}
                      inputMode="numeric"
                    />
                  )}
                </Field>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kiedy parking jest dostępny</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <RadioGroup
                name="availabilityMode"
                legend="Dostępność"
                value={values.availabilityMode}
                onValueChange={(value) => set("availabilityMode", value)}
                options={[
                  { value: "ALWAYS", label: "Zawsze", hint: "Cała doba, siedem dni w tygodniu." },
                  {
                    value: "RECURRING_SCHEDULE",
                    label: "W stałych godzinach",
                    hint: "Np. po godzinach pracy i w weekendy.",
                  },
                  {
                    value: "EVENT_ONLY",
                    label: "Tylko na wydarzenia",
                    hint: "Udostępniasz miejsca pod konkretne mecze i targi.",
                  },
                ]}
              />

              {values.availabilityMode === "RECURRING_SCHEDULE" ? (
                <div className="flex flex-col gap-3">
                  <p className="text-ui text-muted">
                    Godziny lokalne. Zapis „17:00–24:00” znaczy: od 17 do północy.
                  </p>

                  {fieldError("schedule") ? (
                    <p role="alert" className="text-ui text-danger">
                      {fieldError("schedule")}
                    </p>
                  ) : null}

                  {DAYS.map(({ key, label }) => {
                    const slots = values.schedule[key] ?? [];
                    return (
                      <div key={key} className="flex flex-col gap-2 border-t border-line pt-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ui font-semibold text-ink">{label}</span>
                          {slots.length < 2 ? (
                            <Button size="sm" variant="ghost" onClick={() => addSlot(key)}>
                              <Plus size={16} aria-hidden="true" />
                              Dodaj godziny
                            </Button>
                          ) : null}
                        </div>

                        {slots.length === 0 ? (
                          <span className="text-ui text-muted">Niedostępny</span>
                        ) : null}

                        {slots.map((slot, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={slot.from}
                              onChange={(event) => setSlot(key, index, { from: event.target.value })}
                              aria-label={`${label} — od`}
                              className="flex-1"
                            />
                            <span aria-hidden="true" className="text-muted">
                              –
                            </span>
                            <Input
                              type="time"
                              value={slot.to}
                              onChange={(event) => setSlot(key, index, { to: event.target.value })}
                              aria-label={`${label} — do`}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeSlot(key, index)}
                              aria-label={`Usuń godziny: ${label}`}
                            >
                              <X size={16} aria-hidden="true" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 xs:grid-cols-2">
                <Field
                  label="Minimalna rezerwacja"
                  error={fieldError("minBookingMinutes")}
                  hint="W minutach."
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={values.minBookingMinutes}
                      onChange={(event) => set("minBookingMinutes", event.target.value)}
                      inputMode="numeric"
                      suffix="min"
                    />
                  )}
                </Field>

                <Field
                  label="Darmowe minuty"
                  error={fieldError("freeMinutes")}
                  hint="Np. 15 minut na podjazd i wyjazd."
                >
                  {(props) => (
                    <Input
                      {...props}
                      value={values.freeMinutes}
                      onChange={(event) => set("freeMinutes", event.target.value)}
                      inputMode="numeric"
                      suffix="min"
                    />
                  )}
                </Field>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Wypłata</CardTitle>
              <CardMeta>Na to konto przelejemy Twoją część po każdym rozliczeniu.</CardMeta>
            </CardHeader>
            <CardBody>
              <Field label="Numer konta" error={fieldError("payoutBankAccount")}>
                {(props) => (
                  <Input
                    {...props}
                    value={values.payoutBankAccount}
                    onChange={(event) => set("payoutBankAccount", event.target.value)}
                    placeholder="PL00 0000 0000 0000 0000 0000 0000"
                    autoComplete="off"
                    inputMode="numeric"
                  />
                )}
              </Field>
            </CardBody>
          </Card>
        </>
      ) : null}

      {/* Main action at the bottom, in reach of a thumb (DESIGN_PRINCIPLES §6.6). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <Progress
            value={completeness}
            label="Kompletność profilu"
            hint={`${completeness}%`}
          />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/panel/parkingi")}>
              Wróć
            </Button>
            <Button type="submit" variant="accent" size="lg" loading={submitting} block>
              {isPublished ? "Zapisz zmiany" : "Wyślij do sprawdzenia"}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Bits                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Three states, not two: "nie podano" is not the same answer as "nie", and a driver
 * deciding between two lots deserves to know which one it is.
 */
function TriField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Tri;
  onChange: (value: Tri) => void;
}) {
  return (
    <Field label={label}>
      {(props) => (
        <Select
          {...props}
          value={value}
          onChange={(event) => onChange(event.target.value as Tri)}
        >
          <option value="">Nie podano</option>
          <option value="true">Tak</option>
          <option value="false">Nie</option>
        </Select>
      )}
    </Field>
  );
}

function SaveIndicator({
  state,
  savedAt,
  onRetry,
}: {
  state: SaveState;
  savedAt: Date | null;
  onRetry: () => void;
}) {
  if (state === "error") {
    return (
      <p role="alert" className="flex items-center gap-2 text-ui text-danger">
        <CloudOff size={16} aria-hidden="true" />
        <span>Nie zapisaliśmy ostatniej zmiany. Nic nie przepadło z wcześniejszych.</span>
        <Button size="sm" variant="ghost" onClick={onRetry}>
          <RefreshCw size={14} aria-hidden="true" />
          Ponów
        </Button>
      </p>
    );
  }

  if (state === "saving") {
    return (
      <p aria-live="polite" className="flex items-center gap-2 text-ui text-muted">
        <Save size={16} aria-hidden="true" />
        Zapisujemy…
      </p>
    );
  }

  if (state === "saved" && savedAt) {
    return (
      <p aria-live="polite" className="flex items-center gap-2 text-ui text-muted">
        <Check size={16} aria-hidden="true" />
        Szkic zapisany o {formatTimePL(savedAt)}
      </p>
    );
  }

  // Nothing has been saved yet, so there is no status to report. The page header
  // already promises the autosave; repeating it here would make a status line do
  // two jobs and say the same thing twice on the same screen.
  return null;
}
