"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui";
import type { GeocodeItem } from "./types";

/**
 * Debounced address autocomplete against our own /geocode proxy (only the typed
 * string leaves the server — no lead PII). Options are focusable buttons, so a
 * keyboard user can Tab into the list. (Arrow-key roving is a later polish.)
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
  const [items, setItems] = useState<GeocodeItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    if (trimmed.length < 3) {
      setItems([]);
      setOpen(false);
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
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setError("Nie udało się wyszukać adresu. Kliknij miejsce na mapie albo spróbuj ponownie.");
          setItems([]);
        }
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          search(event.target.value);
        }}
        onFocus={() => {
          if (items.length > 0) setOpen(true);
        }}
        placeholder="np. ul. Bułgarska 17, Poznań"
        autoComplete="off"
        aria-label="Adres obiektu"
        role="combobox"
        aria-expanded={open}
        aria-controls="geo-suggestions"
      />

      {open && items.length > 0 ? (
        <ul
          id="geo-suggestions"
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-line bg-surface py-1 shadow-float"
        >
          {items.map((item, index) => (
            <li key={`${item.lat},${item.lng},${index}`} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onPick(item);
                  onChange(item.label);
                  setOpen(false);
                }}
                className="block min-h-touch w-full px-3 py-2 text-left text-body text-ink hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? <p className="mt-1 text-ui text-muted">Szukam…</p> : null}
      {error ? (
        <p role="alert" className="mt-1 text-ui text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
