"use client";

import { Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui";
import type { GeocodeItem } from "./types";

/**
 * Debounced address autocomplete against our own /geocode proxy (only the typed
 * string leaves the server — no lead PII).
 *
 * The field used to look like any other text input and behave like one: no
 * search affordance, suggestions reachable by mouse only, and silence when the
 * geocoder found nothing. So it read as "type your address here for the record"
 * rather than "search". Everything below is about making the search visible —
 * the magnifier, the live status line, arrow keys, and an answer for every
 * outcome including the empty one.
 */
export function AddressField({
  value,
  onChange,
  onPick,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (item: GeocodeItem) => void;
}) {
  const listId = useId();
  const [items, setItems] = useState<GeocodeItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null = nothing highlighted; the list opens without pre-selecting a result. */
  const [active, setActive] = useState<number | null>(null);
  /** Set once a search has come back, so "nothing found" is not shown before it. */
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  function search(q: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = q.trim();
    setActive(null);

    if (trimmed.length < 3) {
      abortRef.current?.abort();
      setItems([]);
      setOpen(false);
      setSearched(false);
      setLoading(false);
      setError(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/dla-wlascicieli/geocode?q=${encodeURIComponent(trimmed)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error("geocode");
        const data = (await res.json()) as { items?: GeocodeItem[] };
        setItems(Array.isArray(data.items) ? data.items : []);
        setSearched(true);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Wyszukiwarka adresów nie odpowiada. Kliknij miejsce na mapie.");
          setItems([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  function choose(item: GeocodeItem) {
    onPick(item);
    onChange(item.label);
    setOpen(false);
    setActive(null);
    setSearched(false);
  }

  function clear() {
    onChange("");
    setItems([]);
    setOpen(false);
    setSearched(false);
    setError(null);
    inputRef.current?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(null);
      return;
    }

    // Enter must not submit the form around this field — it picks an address.
    if (event.key === "Enter") {
      if (!open || items.length === 0) return;
      event.preventDefault();
      const pick = items[active ?? 0];
      if (pick) choose(pick);
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (items.length === 0) return;
    event.preventDefault();
    setOpen(true);
    setActive((current) => {
      if (event.key === "ArrowDown") {
        return current === null || current === items.length - 1 ? 0 : current + 1;
      }
      return current === null || current === 0 ? items.length - 1 : current - 1;
    });
  }

  const nothingFound = open && searched && !loading && items.length === 0 && value.trim().length >= 3;

  return (
    <div className="relative">
      <div className="relative">
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <Input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            search(event.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (items.length > 0) setOpen(true);
          }}
          placeholder="Wpisz ulicę i numer, np. Bułgarska 17"
          autoComplete="off"
          aria-label="Szukaj adresu obiektu"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active === null ? undefined : `${listId}-${active}`}
          className="pl-10 pr-10"
        />

        {loading ? (
          <Loader2
            size={18}
            aria-hidden="true"
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted"
          />
        ) : value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Wyczyść adres"
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-button text-muted transition-colors duration-micro hover-hover:hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <X size={18} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Podpowiedzi adresów"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-line bg-surface py-1 shadow-float"
        >
          {items.map((item, index) => (
            <li key={`${item.lat},${item.lng},${index}`}>
              <button
                type="button"
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active === index}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(item)}
                className={[
                  "flex min-h-touch w-full items-center gap-2 px-3 py-2 text-left text-body",
                  active === index ? "bg-surface-2 text-ink" : "text-ink",
                ].join(" ")}
              >
                <MapPin size={16} aria-hidden="true" className="shrink-0 text-muted" />
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        One line, one job, and it never stacks: whichever of these is true, the
        field says what just happened instead of going quiet (DESIGN_PRINCIPLES
        §6.1). An empty result is an answer too — with a way out of it.
      */}
      <p className="mt-1 min-h-[1.25rem] text-ui" role="status" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : loading ? (
          <span className="text-muted">Szukam adresu…</span>
        ) : nothingFound ? (
          <span className="text-muted">
            Nie znaleźliśmy takiego adresu. Sprawdź pisownię albo kliknij miejsce na mapie.
          </span>
        ) : (
          <span className="text-muted">Albo kliknij miejsce na mapie.</span>
        )}
      </p>
    </div>
  );
}
