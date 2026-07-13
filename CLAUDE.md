# CLAUDE.md — ParkSpot

Ten plik jest czytany na starcie każdej sesji. Trzymaj go krótkim i aktualnym.

---

## Czym jest ten projekt

Marketplace parkingowy. Agreguje niewykorzystaną podaż miejsc parkingowych (firmy po godzinach, osoby prywatne, komercyjni operatorzy) i sprzedaje rezerwacje kierowcom — ze szczególnym naciskiem na wydarzenia masowe w Poznaniu (mecze Lecha na Enea Stadionie, targi na MTP).

**Model przychodowy:** prowizja od transakcji. Domyślnie 50% od osób prywatnych, 30% od firm.

**Kim jest użytkownik:** kierowca stojący na deszczu pod stadionem z telefonem w jednej ręce, 8 minut przed gwizdkiem. Projektuj wszystko dla niego.

---

## Dokumenty źródłowe (czytaj przed pracą)

- `docs/ARCHITECTURE.md` — architektura i decyzje technologiczne
- `docs/DATA_MODEL.md` — schemat bazy
- `docs/API_SPEC.md` — endpointy
- `docs/PAYMENTS.md` — flow płatności, split, prowizje
- `docs/DESIGN_PRINCIPLES.md` — **zasady designu i UX. Obowiązkowe przed dotknięciem czegokolwiek wizualnego.**
- `docs/ROADMAP.md` — fazy wdrożenia
- `docs/RISKS.md` — ryzyka

---

## Stack

- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui
- **Mapa:** MapLibre GL JS + OpenStreetMap (NIE Google Maps)
- **Baza:** PostgreSQL + **PostGIS** (zapytania geo na indeksie GiST, nigdy filtrowanie w JS)
- **ORM:** Drizzle
- **Auth:** własny JWT (access 15 min + refresh 7 dni w httpOnly cookie), Argon2id. **Nie NextAuth.**
- **Płatności:** patrz `docs/PAYMENTS.md` — decyzja podejmowana świadomie, nie domyślnie
- **Deployment:** Docker + Coolify na VPS (Hetzner CX33)
- **Testy:** Vitest (unit), Playwright (e2e ścieżek krytycznych)

---

## Konwencje

- **Kod, nazwy zmiennych, komentarze, commity: angielski. UI i copy: polski.**
- Walidacja Zod na wejściu **każdego** endpointu, po stronie serwera. Nigdy nie ufaj frontowi.
- **Ceny liczone wyłącznie na serwerze.** Kwota przysłana z frontu jest ignorowana.
- Kwoty w bazie: **grosze, jako integer.** Nigdy float na pieniądzach.
- Czas w bazie: **UTC, `timestamptz`.** Konwersja na `Europe/Warsaw` dopiero w warstwie prezentacji.
- Współrzędne: PostGIS `geography(Point, 4326)`, zawsze z indeksem GiST.
- Sekrety w `.env`, nigdy w repo. Utrzymuj aktualny `.env.example`.
- Nie loguj danych osobowych ani payloadów płatności do konsoli.

---

## Zasady pracy ze mną

- **Pytaj, zanim założysz.** Niejasne wymaganie = pytanie, nie zgadywanie.
- **Kwestionuj mnie.** Jeśli mój pomysł jest zły — powiedz to wprost i zaproponuj alternatywę. Nie chcę potakiwania.
- **Zatrzymuj się po każdej ukończonej fazie z ROADMAP.md** i czekaj na akceptację.
- Commituj małymi krokami, po każdym logicznym module.
- **Nie rozdmuchuj scope'u.** Lista rzeczy, których świadomie NIE budujemy w MVP, jest w `docs/ROADMAP.md`. Trzymaj się jej.

---

## Rzeczy, o które łatwo się potknąć w tym projekcie

**Sprzedaż tego samego miejsca dwa razy.** Sprawdzanie dostępności i tworzenie rezerwacji muszą być w jednej transakcji z blokadą wiersza. To nie jest opcjonalne.

**Skaner QR bez internetu.** Przy 40 tys. ludzi pod stadionem sieć komórkowa pada. Kody na dany event muszą być pobrane do IndexedDB **zanim** event się zacznie, walidowane lokalnie, synchronizowane po odzyskaniu sieci. Bez tego host stoi przy bramie z kolejką 200 osób i martwą aplikacją.

**Wjazd nie jest tam, gdzie parking.** `entranceLocation` to osobny punkt geograficzny niż `location`. Nawigacja kierowcy prowadzi do wjazdu, nie do środka placu.

**Wysokość pojazdu.** Parking podziemny ma 1,9 m, SUV ma 2,1 m. Filtruj to *przed* sprzedażą, nie tłumacz po fakcie.

**Dystans pieszo ≠ dystans w linii prostej.** Nie pokazuj odległości euklidesowej jako „800 m pieszo". Albo policz routing pieszy, albo wyraźnie oznacz, że to w linii prostej.

**Webhooki płatności.** Weryfikuj podpis. Zapewnij idempotencję — ten sam webhook przyjdzie kilka razy.

**Dane osobowe.** RODO nie jest opcjonalne. Zgody przy rejestracji, eksport danych, usunięcie konta.

---

## Stan projektu

*(aktualizuj tę sekcję po każdej ukończonej fazie)*

- [ ] Faza 1 — Auth + model parkingu + formularz + mapa
- [ ] Faza 2 — Eventy + nakładka na mapę + deklaracja dostępności hosta
- [ ] Faza 3 — Rezerwacje + płatności + QR + powiadomienia
- [ ] Faza 4 — Panel hosta (skaner offline) + panel admina
- [ ] Faza 5 — Hardening, testy e2e, deployment
