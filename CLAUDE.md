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
- `docs/DESIGN_SYSTEM.md` — tokeny i komponenty (szkielet — wypełni się po wyborze kierunku wizualnego)
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

- [x] Faza projektowa — komplet dokumentów w `docs/` (2026-07-13)
  - Design: motyw jasny „Bilet", ciemny „Zmierzch" — wybrany, tokeny w `tailwind.config.ts`
- [x] Faza 0 — scaffolding (Next.js, Docker, Drizzle, seed)
- [x] Faza 1 — Auth + model parkingu + formularz + mapa
- [x] Faza 2 — Eventy + nakładka na mapę + deklaracja dostępności hosta
- [x] Faza 3 — Rezerwacje + płatności + QR + powiadomienia
- [x] Faza 4 — Panel hosta (skaner offline) + panel admina
- [ ] Faza 5 — Hardening, testy e2e, deployment ← **TU JESTEŚMY**

**Bramka jakości (stan na 2026-07-14, wszystko uruchomione, nie zadeklarowane):**

| | |
|---|---|
| `npx tsc --noEmit` | ✅ |
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npx vitest run` (unit) | ✅ 77/77 |
| `npm run test:integration` | ✅ 27/27 na żywym PostGIS |
| `npm run test:e2e` | ✅ 10/10 (Playwright) |

**Baza DZIAŁA i ma dane.** PostgreSQL 16 + PostGIS 3.6 (WSL, `localhost:5433`). Migracje i seed
wykonane: 26 tabel, 17 eventów (mecze Lecha + targi MTP), 20 parkingów, 4 konta testowe
(`admin@` / `host@` / `firma@` / `kierowca@parkspot.pl`, hasło `parkspot123`).
Ścieżka zakupu przejechana end-to-end na żywym serwerze: rezerwacja → intent → webhook →
CONFIRMED + kod + QR + instrukcje wjazdu. Skaner: WPUŚĆ → drugi skan tego samego kodu → odrzucony.

- [x] Strona `/konto` — zgody, eksport, usunięcie konta (**luka RODO zamknięta**)
- [x] `users.stripe_account_id` / `charges_enabled` / `payouts_enabled` + `@stripe/stripe-js`;
      publikacja parkingu zablokowana, dopóki host nie przejdzie KYC (tylko na `PAYMENT_PROVIDER=stripe`)
- [x] Testy integracyjne i e2e istnieją i przechodzą

**Co NIE jest zrobione — nie udawaj, że jest:**

- [ ] **Obraz Dockera nigdy się nie zbudował.** Nie ma już `docker-compose*.yml` — jednostką
      deploymentu jest jeden obraz produkcyjny z `Dockerfile` (baza stoi na VPS-ie, poza obrazem).
      Demon Dockera nie wstaje w tym środowisku: usługa `com.docker.service` jest zatrzymana,
      a jej uruchomienie wymaga podniesionych uprawnień, których sesja nie ma. **`docker build`
      nie przeszedł ani razu — to niezweryfikowana ścieżka deploymentu.** Pierwszy build na
      maszynie z działającym Dockerem jest jednocześnie pierwszym testem.
      Zweryfikowane *jest* natomiast to, co obraz odpala przy starcie: `scripts/migrate.mjs`
      i zbundlowany `dist/seed.mjs` przejechane na żywym PostGIS-ie, bez `tsx`.
- [ ] **Brak `PATCH /api/me`** → „Moje dane" na `/konto` są read-only. Telefon da się ustawić tylko
      przy zakupie. Zły numer = brak SMS-a z kodem i brak sposobu, żeby to naprawić.
- [ ] **Seed nie zawiera ani jednej deklaracji hosta na event** (`event_parking_availability` = 0 wierszy).
      Sprzedaż eventowa działa (parking z `availability_mode` pokrywającym okno sprzedaje się bez
      deklaracji), ale panel hosta „Wydarzenia", quick-declare z maila i skaner są po seedzie puste.
- [ ] Stripe przetestowany wyłącznie na mocku — brak testu na prawdziwym koncie testowym Stripe.

**Wymagany Node ≥ 22** (Vitest 4 potrzebuje `util.styleText`). Na Node 21 testy nie wystartują.
