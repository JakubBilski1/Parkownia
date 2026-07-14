# ARCHITECTURE.md — ParkSpot

Architektura systemu i decyzje technologiczne z uzasadnieniem. Stan: faza projektowa, przed pierwszą linią kodu produkcyjnego.

---

## 1. Zasada nadrzędna

**Monolit Next.js na jednym VPS-ie, dopóki nie zaboli.** MVP ma kilkudziesięciu hostów i setki transakcji miesięcznie — to skala, którą obsłuży jeden proces Node i jedna baza PostgreSQL. Każda dodatkowa usługa to koszt operacyjny bez zysku. Granice modułów trzymamy w kodzie (katalogi domenowe), nie w sieci.

---

## 2. Diagram komponentów

```
                            ┌─────────────────────────────┐
                            │   Przeglądarka (PWA)        │
                            │  Next.js RSC + MapLibre GL  │
                            │  Service Worker + IndexedDB │◄── offline: skaner QR
                            └──────────────┬──────────────┘
                                           │ HTTPS
┌──────────────────────────────────────────┴──────────────────────────────────────┐
│  VPS Hetzner CX33 · Docker (Coolify)                                            │
│                                                                                 │
│  ┌───────────────────────────────────────────────┐   ┌──────────────────────┐  │
│  │  Next.js 15 (App Router) — monolit            │   │  PostgreSQL 16       │  │
│  │                                               │   │  + PostGIS           │  │
│  │  app/            UI (RSC, PL)                 │──▶│                      │  │
│  │  app/api/        API Routes (webhooki, scan)  │   │  GiST: location,     │  │
│  │  src/modules/    logika domenowa:             │   │        entrance      │  │
│  │    auth/  parkings/  events/  bookings/       │   └──────────────────────┘  │
│  │    payments/  payouts/  notifications/        │   ┌──────────────────────┐  │
│  │    scan/  admin/                              │──▶│  MinIO (S3 API)      │  │
│  │  src/db/         Drizzle schema + migracje    │   │  zdjęcia parkingów   │  │
│  └───────┬───────────────┬───────────────┬───────┘   └──────────────────────┘  │
└──────────┼───────────────┼───────────────┼─────────────────────────────────────┘
           │               │               │
   ┌───────▼──────┐ ┌──────▼───────┐ ┌─────▼──────────────────────────┐
   │ PSP           │ │ E-mail: Resend│ │ API rządowe:                  │
   │ (BLIK, karty, │ │ SMS: SMSAPI   │ │  Biała Lista VAT (bez klucza) │
   │  webhooki —   │ │ (feature flag)│ │  GUS REGON BIR1 (opcjonalne)  │
   │  docs/PAYMENTS│ └──────────────┘ │ Geokoder: Nominatim → Geoapify │
   └───────────────┘                  └────────────────────────────────┘
```

---

## 3. Stack i uzasadnienia decyzji

| Warstwa | Wybór | Dlaczego tak / dlaczego nie inaczej |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Jeden framework na front i backend = jeden deploy, jeden język. RSC ogranicza JS na słabych telefonach (nasz user). **Nie mikroserwisy:** skala MVP tego nie uzasadnia, a podwoiłoby koszt operacyjny. |
| Mutacje | Server Actions dla formularzy; API Routes tam, gdzie klient nie jest naszym frontem | Webhooki PSP, walidacja skanu, sync offline — to musi być zwykły HTTP endpoint ze stabilnym kontraktem. Formularze (dodanie parkingu, rejestracja) — Server Actions, mniej boilerplate'u. Obie ścieżki przechodzą przez ten sam moduł domenowy i tę samą walidację Zod. |
| Baza | PostgreSQL 16 + PostGIS | Zapytania „parkingi w promieniu X" i bounding-box na indeksie GiST. **Nigdy filtrowanie geo w JS** — przy 500 parkingach jeszcze by uszło, przy 5000 nie, a migracja bolałaby. |
| ORM | Drizzle | Lekki, generuje migracje SQL, nie walczy z raw SQL — a PostGIS (`ST_DWithin`, `ST_MakeEnvelope`) wymaga raw SQL. Typy `geography` mapujemy przez `customType`. |
| Auth | Własny JWT: access 15 min (pamięć klienta) + refresh 7 dni (httpOnly cookie, rotowany), Argon2id | **Nie NextAuth:** potrzebujemy tablicy ról na koncie (DRIVER + host jednocześnie), upgrade'u konta do hosta i flow rejestracji firmowej z NIP — w NextAuth to walka z frameworkiem. Rotacja refresh tokenów z detekcją ponownego użycia (kradziony token unieważnia rodzinę). |
| Mapa | MapLibre GL JS + kafelki OSM | **Nie Google Maps:** koszt przy skali i licencyjny zakaz cache'owania kafelków. MapLibre = open source, styl kafelków pod kontrolą (istotne dla przyszłego designu). Klastrowanie: `supercluster`. |
| Geokoder | Nominatim (dev) → Geoapify/LocationIQ (prod) | Nominatim ma limit 1 req/s i zakaz użycia produkcyjnego przy ruchu — wystarczy do developmentu. Wywołania za wspólnym interfejsem `Geocoder`, podmiana = konfiguracja. |
| Pliki | MinIO (S3 API) w Dockerze | Zdjęcia parkingów. S3-compatible od dnia 1 — jak urośniemy, wskaźnik na prawdziwe S3/R2 bez zmiany kodu. Upload przez presigned URL (pliki nie przechodzą przez proces Next). |
| Płatności | Decyzja otwarta — porównanie w `docs/PAYMENTS.md` | Schemat bazy provider-agnostyczny (tabele `payments`, `payouts` istnieją od początku), więc wybór PSP nie zmienia modelu danych. |
| E-mail / SMS | Resend + React Email; SMS przez SMSAPI za feature flagą | SMS ~0,08–0,12 zł/szt. przy prowizji ~6 zł to widoczny koszt — tylko potwierdzenie rezerwacji i przypomnienie 2 h przed, wyłączalne globalnie. |
| Deploy | Docker + docker-compose; Coolify na Hetzner CX33 | `Dockerfile` (standalone output Next), `docker-compose.yml` (app + postgres/postgis + minio) od pierwszego dnia — środowisko dev = prod. |
| Testy | Vitest (unit: ceny, prowizje, dostępność, NIP) + Playwright (e2e: rejestracja → parking → zakup → skan) | Logika pieniędzy i dostępności ma testy jednostkowe **zanim** dostanie UI. |

---

## 4. Struktura katalogów (docelowa)

```
src/
  modules/            # logika domenowa — jedyne miejsce z regułami biznesowymi
    auth/             # rejestracja, logowanie, JWT, role, NIP/Biała Lista
    parkings/         # CRUD, moderacja, dostępność, cennik
    events/           # venues, eventy, EventParkingAvailability
    bookings/         # dostępność transakcyjna, kody rezerwacji
    payments/         # abstrakcja PSP, webhooki, idempotencja
    payouts/          # naliczanie prowizji, raporty wypłat
    notifications/    # e-mail/SMS, szablony, feature flags
    scan/             # walidacja QR, paczki offline, sync
    admin/            # moderacja, prowizje, dashboard
  db/                 # schema Drizzle, migracje, seed
  lib/                # współdzielone: zod-schematy, geocoder, s3, rate-limit
app/                  # routing + UI (PL); strony wołają moduły, nie bazę
app/api/              # webhooki, scan, sync — cienkie adaptery na moduły
```

Reguła zależności: `app/` → `modules/` → `db/`. Nigdy odwrotnie, nigdy z pominięciem warstwy (strona nie robi zapytań SQL).

---

## 5. Kluczowe przepływy

### 5.1. Zakup miejsca (ścieżka krytyczna — 8 minut do gwizdka)

```
Kierowca                    Serwer                              PSP
   │ wybiera parking+termin    │                                 │
   ├──────────────────────────▶│ 1. cena liczona NA SERWERZE     │
   │                           │ 2. BEGIN;                       │
   │                           │    SELECT ... FOR UPDATE        │
   │                           │    (blokada wiersza parkingu)   │
   │                           │    check: capacity − aktywne    │
   │                           │    rezerwacje w oknie > 0       │
   │                           │    INSERT booking PENDING (TTL) │
   │                           │    COMMIT;                      │
   │                           ├────────────────────────────────▶│ intent (BLIK/karta)
   │ ◀─ ekran płatności ───────┤                                 │
   │ płaci                     │                                 │
   │                           │◀──────────── webhook ───────────┤
   │                           │ 3. weryfikacja podpisu          │
   │                           │ 4. idempotencja (event_id już   │
   │                           │    przetworzony? → 200, koniec) │
   │                           │ 5. booking → CONFIRMED,         │
   │                           │    kod PK-XXXX-XXXX + QR        │
   │ ◀─ mail + SMS z kodem ────┤ 6. dopiero teraz widzi          │
   │                           │    accessInstructions           │
```

Zasady nienaruszalne:
- **Dostępność i utworzenie rezerwacji w jednej transakcji z `SELECT ... FOR UPDATE`** na wierszu parkingu. Szczegóły strategii w `docs/DATA_MODEL.md`.
- Rezerwacja `PENDING` ma TTL (15 min) — nieopłacona zwalnia miejsce (sprzątanie: sprawdzenie przy każdym odczycie dostępności + cron).
- Kwota z frontu jest ignorowana; webhook porównuje kwotę z PSP z kwotą rezerwacji.

### 5.2. Skan QR offline (host przy bramie, sieć padła)

```
PRZED eventem (jest sieć):
  panel hosta → GET /api/scan/manifest?eventId=…
  → lista {kod_hash, status, okno_czasowe} dla parkingów hosta
  → zapis do IndexedDB (Service Worker precache'uje shell skanera)

PRZY BRAMIE (sieci brak):
  kamera → dekodowanie QR lokalnie → lookup w IndexedDB
  → hash(kod) znaleziony? okno pasuje? nie użyty lokalnie?
  → ZIELONY „WPUŚĆ" / CZERWONY z powodem  (+ wibracja)
  → zapis skanu do kolejki lokalnej (timestamp, wynik)

PO ODZYSKANIU SIECI:
  Background Sync / retry → POST /api/scan/sync (batch)
  → serwer rozstrzyga konflikty: kod zeskanowany na 2 urządzeniach
    = pierwszy wygrywa, drugi dostaje flagę do wyjaśnienia
```

W manifeście trzymamy **hash kodu, nie kod** — wyciek IndexedDB z telefonu hosta nie pozwala podrobić biletów.

### 5.3. Deklaracja dostępności hosta (aktywacja podaży)

```
cron (dzienny) → eventy startujące za 7 dni
  → hostowie z parkingami w searchRadiusMeters (ST_DWithin)
  → mail: „W sobotę Lech gra z Cracovią. Twój parking jest 800 m
     od stadionu i stoi pusty. Udostępnij jednym kliknięciem →"
  → link z podpisanym tokenem (JWT, cel: jedna akcja, ważny do eventu)
  → strona z JEDNYM pytaniem → [Tak, N miejsc po X zł] [Nie tym razem]
  → INSERT/UPDATE event_parking_availability
```

Link działa bez logowania (token identyfikuje hosta i event) — każde dodatkowe pole to spadek konwersji podaży.

---

## 6. Bezpieczeństwo — decyzje architektoniczne

- **Walidacja Zod na wejściu każdego endpointu i każdej Server Action.** Schematy w `src/lib/validation/`, współdzielone z frontem (ten sam schemat waliduje formularz i request).
- **Rate limiting** (token bucket w Postgresie — bez Redisa w MVP): auth 5/min/IP, płatności 10/min/user, Biała Lista 3/min/user.
- **Webhooki:** weryfikacja podpisu + tabela `webhook_events` z unikalnym `event_id` (idempotencja na poziomie bazy).
- **RODO:** zgody przy rejestracji (osobne checkboxy, wersjonowane), eksport danych (JSON na żądanie), usunięcie konta = anonimizacja (rezerwacje zostają dla rozliczeń, dane osobowe znikają). Logi bez PII i bez payloadów płatności.
- Sekrety wyłącznie w `.env`; `.env.example` utrzymywany na bieżąco.

---

## 7. PWA

- `public/manifest.json` + **własnoręcznie napisany Service Worker (`public/sw.js`)**. Bez `serwist`/Workbox — precache shellu skanera to kilkanaście linii, a zależność, która generuje SW w buildzie, kosztowałaby więcej niż daje. Rejestracja tylko przy `NODE_ENV=production` (`src/components/pwa-register.tsx`).
- IndexedDB: manifesty skanów per event + kolejka wyników do synchronizacji.
- Offline dotyczy **skanera hosta**. Mapa i zakup wymagają sieci — nie udajemy, że nie.

## 8. i18n

- **Brak warstwy i18n. Polskie stringi siedzą wprost w komponentach.** MVP jest jednojęzyczny, a `next-intl` postawiony „na zapas" to dziś koszt bez korzyści.
- Furtka: copy jest skupione w komponentach i w `src/modules/*/reasons.ts` / `errors.ts`, więc dodanie EN (targi MTP) to wyciągnięcie stringów, nie przepisanie logiki.
- **Odmiana liczby mnogiej idzie przez `pluralPl()` (`src/lib/format.ts`)** — polski ma trzy formy i „3 miejsc" jest błędem gramatycznym, nie literówką. Nie interpoluj rzeczownika po liczbie ręcznie.

---

## 9. Co świadomie odkładamy (i gdzie zostawiamy furtkę)

| Odłożone | Furtka w architekturze |
|---|---|
| Routing pieszy (OSRM/Valhalla) | MVP: dystans euklidesowy × 1,3, w UI jawnie „ok. X m pieszo"; interfejs `DistanceProvider` do podmiany |
| Redis (cache, kolejki) | Rate limit i cron w Postgresie; przy skali podmieniamy implementację, nie moduły |
| Abonamenty miesięczne | `price_per_month` w schemacie, brak UI |
| Wielomiastowość | Venue/parking mają współrzędne, nic nie hardkoduje Poznania poza seedem i copy |
| Aplikacja natywna, czat, recenzje, dynamiczne ceny, IoT szlabanów | Poza MVP — patrz `docs/ROADMAP.md` |
