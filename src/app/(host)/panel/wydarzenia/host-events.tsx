"use client";

import { useState } from "react";
import { Card, CardBody, Switch, useToast } from "@/components/ui";
import {
  formatDatePL,
  formatMoney,
  formatSpots,
  formatTimeRangePL,
  formatWalkDistance,
} from "@/lib/format";
import type { HostEvent } from "@/modules/events/availability";

type Declaration = { isAvailable: boolean; spots: number; priceGr: number };

type HostEventsProps = { events: HostEvent[] };

function key(eventId: string, parkingId: string): string {
  return `${eventId}:${parkingId}`;
}

/**
 * The toggle answers instantly and syncs in the background (Doherty threshold,
 * docs/DESIGN_PRINCIPLES.md §6.1). A failed sync rolls the switch back and says
 * so — it never leaves the host believing a parking is open when it is not.
 */
export function HostEvents({ events }: HostEventsProps) {
  const { toast } = useToast();

  const [state, setState] = useState<Record<string, Declaration>>(() => {
    const initial: Record<string, Declaration> = {};
    for (const event of events) {
      for (const parking of event.parkings) {
        initial[key(event.id, parking.parkingId)] = {
          isAvailable: parking.isAvailable ?? false,
          spots: parking.suggestedSpots,
          priceGr: parking.suggestedPriceGr,
        };
      }
    }
    return initial;
  });

  const [syncing, setSyncing] = useState<Record<string, boolean>>({});

  async function toggle(event: HostEvent, parkingId: string, next: boolean) {
    const id = key(event.id, parkingId);
    const current = state[id];
    if (!current) return;

    setState((previous) => ({ ...previous, [id]: { ...current, isAvailable: next } }));
    setSyncing((previous) => ({ ...previous, [id]: true }));

    try {
      const response = await fetch(`/api/host/events/${event.id}/availability`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parkingId,
          isAvailable: next,
          spots: next ? current.spots : null,
          priceGr: next ? current.priceGr : null,
        }),
      });

      if (!response.ok) throw new Error("sync failed");

      if (next) {
        toast({
          tone: "ok",
          message: "Parking udostępniony",
          detail: `${event.title}: ${formatSpots(current.spots)} po ${formatMoney(current.priceGr)}.`,
        });
      }
    } catch {
      setState((previous) => ({ ...previous, [id]: { ...current, isAvailable: !next } }));
      toast({
        tone: "error",
        message: "Nie zapisaliśmy zmiany",
        detail: "Parking pozostaje w poprzednim stanie. Sprawdź połączenie i spróbuj ponownie.",
      });
    } finally {
      setSyncing((previous) => ({ ...previous, [id]: false }));
    }
  }

  return (
    <ol className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id}>
          <Card>
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="num text-ui text-muted">
                  {formatDatePL(event.startsAt)} ·{" "}
                  {formatTimeRangePL(event.startsAt, event.endsAt)} · {event.venueName}
                </span>
                <h2 className="font-display text-h3 font-bold text-ink">{event.title}</h2>
              </div>

              <div className="flex flex-col gap-3">
                {event.parkings.map((parking) => {
                  const id = key(event.id, parking.parkingId);
                  const declaration = state[id];
                  if (!declaration) return null;

                  return (
                    <Switch
                      key={parking.parkingId}
                      label={parking.parkingTitle ?? "Parking"}
                      hint={
                        declaration.isAvailable
                          ? `${formatWalkDistance(parking.straightLineMeters)} · ${formatSpots(declaration.spots)} po ${formatMoney(declaration.priceGr)}`
                          : `${formatWalkDistance(parking.straightLineMeters)} · nieudostępniony`
                      }
                      checked={declaration.isAvailable}
                      disabled={syncing[id] ?? false}
                      onChange={(changeEvent) =>
                        toggle(event, parking.parkingId, changeEvent.target.checked)
                      }
                    />
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </li>
      ))}
    </ol>
  );
}
