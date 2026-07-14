"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_CATEGORY_LABEL } from "@/modules/admin/labels";
import {
  createVenueAction,
  deleteEventAction,
  deleteVenueAction,
  saveEventAction,
} from "../actions";
import { IDLE } from "../action-result";
import { FieldError, SubmitButton, useActionToast } from "./action-form";

export type VenueOption = { id: string; name: string };

export type EventDefaults = {
  id: string;
  venueId: string;
  title: string;
  description: string | null;
  /** Already converted to Warsaw wall-clock by the server. */
  startsAtLocal: string;
  endsAtLocal: string;
  category: keyof typeof EVENT_CATEGORY_LABEL;
  expectedAttendance: number | null;
  searchRadiusMeters: number;
};

export function EventFormDialog({
  venues,
  event,
  trigger,
}: {
  venues: VenueOption[];
  event?: EventDefaults;
  trigger: "primary" | "quiet";
}) {
  const [state, formAction] = useActionState(saveEventAction, IDLE);
  const [open, setOpen] = useState(false);

  useActionToast(state, () => setOpen(false));

  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <>
      <Button
        variant={trigger === "primary" ? "accent" : "quiet"}
        size={trigger === "primary" ? "md" : "sm"}
        onClick={() => setOpen(true)}
      >
        {event ? "Edytuj" : "Dodaj wydarzenie"}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={event ? "Edytuj wydarzenie" : "Nowe wydarzenie"}
        description="Godziny podajesz w czasie warszawskim. Promień wyznacza, które parkingi zobaczy kierowca i którym hostom wyślemy pytanie o udostępnienie."
      >
        <form action={formAction} className="flex flex-col gap-4">
          {event ? <input type="hidden" name="eventId" value={event.id} /> : null}

          <Field label="Obiekt" required>
            {(props) => (
              <Select {...props} name="venueId" defaultValue={event?.venueId ?? ""}>
                <option value="" disabled>
                  Wybierz obiekt
                </option>
                {venues.map((venue) => (
                  <option key={venue.id} value={venue.id}>
                    {venue.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Nazwa" required>
            {(props) => (
              <Input
                {...props}
                name="title"
                defaultValue={event?.title ?? ""}
                placeholder="Lech – Cracovia"
              />
            )}
          </Field>
          <FieldError message={fields?.title} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Początek" required>
              {(props) => (
                <Input
                  {...props}
                  name="startsAt"
                  type="datetime-local"
                  defaultValue={event?.startsAtLocal ?? ""}
                />
              )}
            </Field>

            <Field label="Koniec" required>
              {(props) => (
                <Input
                  {...props}
                  name="endsAt"
                  type="datetime-local"
                  defaultValue={event?.endsAtLocal ?? ""}
                />
              )}
            </Field>
          </div>
          <FieldError message={fields?.endsAt ?? fields?.startsAt} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Kategoria" required>
              {(props) => (
                <Select {...props} name="category" defaultValue={event?.category ?? "FOOTBALL"}>
                  {Object.entries(EVENT_CATEGORY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label="Promień wyszukiwania" required hint="Domyślnie 1500 m.">
              {(props) => (
                <Input
                  {...props}
                  name="searchRadiusMeters"
                  type="number"
                  inputMode="numeric"
                  min="200"
                  max="10000"
                  step="100"
                  defaultValue={event?.searchRadiusMeters ?? 1500}
                  suffix="m"
                />
              )}
            </Field>
          </div>

          <Field label="Spodziewana frekwencja">
            {(props) => (
              <Input
                {...props}
                name="expectedAttendance"
                type="number"
                inputMode="numeric"
                min="1"
                defaultValue={event?.expectedAttendance ?? ""}
                placeholder="40000"
              />
            )}
          </Field>

          <Field label="Opis">
            {(props) => (
              <Textarea {...props} name="description" rows={3} defaultValue={event?.description ?? ""} />
            )}
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <SubmitButton variant="accent">
              {event ? "Zapisz wydarzenie" : "Dodaj wydarzenie"}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function DeleteEventButton({ eventId, title }: { eventId: string; title: string }) {
  const [state, formAction] = useActionState(deleteEventAction, IDLE);
  const [open, setOpen] = useState(false);

  useActionToast(state, () => setOpen(false));

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Usuń
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Usuń wydarzenie"
        description={`„${title}” zniknie z mapy i z listy hostów. Jeśli sprzedano na nie rezerwacje, usunięcie się nie uda.`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Zostaw
            </Button>
            <form action={formAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <SubmitButton variant="danger">Usuń wydarzenie</SubmitButton>
            </form>
          </>
        }
      />
    </>
  );
}

export function VenueForm() {
  const [state, formAction] = useActionState(createVenueAction, IDLE);
  useActionToast(state);

  const fields = state.status === "error" ? state.fields : undefined;

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-4 shadow-card"
    >
      <Field label="Nazwa" required className="min-w-[12rem] flex-1">
        {(props) => <Input {...props} name="name" placeholder="Enea Stadion" />}
      </Field>

      <Field label="Adres" className="min-w-[12rem] flex-1">
        {(props) => <Input {...props} name="address" placeholder="Bułgarska 17" />}
      </Field>

      <Field label="Szerokość" required className="w-36">
        {(props) => (
          <Input {...props} name="lat" inputMode="decimal" placeholder="52.3977" />
        )}
      </Field>

      <Field label="Długość" required className="w-36">
        {(props) => (
          <Input {...props} name="lng" inputMode="decimal" placeholder="16.8581" />
        )}
      </Field>

      <Field label="Pojemność" className="w-32">
        {(props) => <Input {...props} name="capacity" type="number" inputMode="numeric" min="1" />}
      </Field>

      <SubmitButton variant="accent">Dodaj obiekt</SubmitButton>

      <FieldError message={fields?.lat ?? fields?.lng ?? fields?.name} />
    </form>
  );
}

export function DeleteVenueButton({ venueId }: { venueId: string }) {
  const [state, formAction] = useActionState(deleteVenueAction, IDLE);
  useActionToast(state);

  return (
    <form action={formAction}>
      <input type="hidden" name="venueId" value={venueId} />
      <SubmitButton variant="danger" size="sm">
        Usuń
      </SubmitButton>
    </form>
  );
}
