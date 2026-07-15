# ROADMAP.md — Parkownia

Każda faza = działający, wdrażalny przyrost. **Po każdej fazie: stop i akceptacja użytkownika przed kolejną.**

---

## Faza 0 — Fundament (przed Fazą 1, drobna)

Scaffolding: Next.js 15 + TypeScript + Tailwind + shadcn/ui, Drizzle + zewnętrzny Postgres/PostGIS (adres w `DATABASE_URL` — bazy nie ma w obrazie), storage S3-compatible (lokalnie MinIO, konfiguracja przez `S3_*`), `.env.example`, CI-lint, Vitest/Playwright skonfigurowane, produkcyjny `Dockerfile` (multi-stage, Next standalone, non-root, `EXPOSE 3000`). Seed venues/events/commission_rules.

**Done =** pusta apka renderuje się; na bazie z rozszerzeniami `postgis`, `citext`, `pgcrypto` (`db/extensions.sql`) przechodzą `npm run db:migrate` i `npm run db:seed`.

## Faza 1 — Auth + model parkingu + formularz + mapa

- Rejestracja/logowanie (JWT + refresh rotacja, Argon2id), role, upgrade do hosta, rejestracja firmowa (NIP → Biała Lista + GUS best-effort, walidacja sumy kontrolnej lokalnie).
- Model parkingu w bazie (pełny, wg DATA_MODEL), formularz dodawania: 5 pól obowiązkowych na pierwszym ekranie, reszta progresywnie, autosave do DRAFT.
- Upload zdjęć (storage S3-compatible, presigned).
- Moderacja minimalna: PENDING_REVIEW → ACTIVE ręcznie w bazie/prostym widoku (pełny panel admina w F4).
- Mapa pełnoekranowa: piny z ceną, klastrowanie, bounding-box query, filtry (4 widoczne + „więcej"), geokoder, „w pobliżu", karta parkingu.
- **Bez płatności** — parkingi tylko do przeglądania.

**Done =** e2e: rejestracja → dodanie parkingu → widoczny na mapie po akceptacji; zapytania geo na GiST (EXPLAIN w teście).

## Faza 2 — Eventy + nakładka + deklaracja hosta

- CRUD venues/events (admin-lite), lista `/wydarzenia`, mapa eventowa: centrowanie, okrąg promienia, parkingi w oknie eventu, cena eventowa, dystans pieszo (euklides × 1,3, oznaczony „ok.").
- Panel hosta: eventy w promieniu + toggle udostępnienia (spots, cena, notatki).
- Mail 7 dni przed eventem + ścieżka „jedno kliknięcie z maila" (action token, bez logowania).

**Done =** host deklaruje dostępność z maila bez logowania; mapa eventu pokazuje tylko zadeklarowane/dostępne parkingi.

## Faza 3 — Rezerwacje + płatności + QR + powiadomienia

- Flow zakupu: dostępność transakcyjna (FOR UPDATE), PENDING z TTL, integracja PSP (wg decyzji z PAYMENTS.md), webhooki (podpis + idempotencja), kod PK-XXXX-XXXX + QR, mail + SMS (feature flag), accessInstructions po opłaceniu.
- Zakup **bez konta przed płatnością** (konto przy okazji), 4 dotknięcia: mapa → pin → Zarezerwuj → BLIK → kod.
- Polityka zwrotów (konfigurowalna) + anulowanie z podglądem konsekwencji.

**Done =** e2e na sandboxie PSP: zakup BLIK → webhook → kod QR w mailu; test równoległych zakupów ostatniego miejsca (jeden wygrywa, drugi 409).

## Faza 4 — Panel hosta (skaner offline) + panel admina

- Skaner: kamera (BarcodeDetector → fallback html5-qrcode), pełnoekranowy zielony „WPUŚĆ"/czerwony z powodem, wibracja, **zawsze widoczne** ręczne wpisanie kodu.
- **Tryb offline:** manifest do IndexedDB przed eventem, walidacja lokalna, kolejka + sync, konflikty (pierwszy wygrywa). PWA: manifest + SW.
- Panel hosta: rezerwacje dziś/nadchodzące, zarobki, historia wypłat.
- Panel admina: moderacja z powodami, CRUD eventów, prowizje, dashboard (GMV, transakcje, prowizja, hostowie, konwersja), transakcje + zwroty, raport wypłat.

**Done =** e2e: skan w trybie samolotowym (manifest pobrany wcześniej) → zielony ekran → sync po odzyskaniu sieci; drugi skan tego samego kodu → czerwony.

## Faza 5 — Hardening, e2e, deployment

- Pełne przejście e2e ścieżek krytycznych (rejestracja → parking → zakup → skan), testy obciążeniowe zapytań mapy, rate limiting wszędzie wg API_SPEC, audyt RODO (eksport, usunięcie, zgody), audyt logów (zero PII), Lighthouse/dostępność ekranów krytycznych (skaner w słońcu!), i18n struktura.
- Deploy na Coolify (Hetzner CX33): **jeden obraz produkcyjny z `Dockerfile`** — `docker build --build-arg NEXT_PUBLIC_APP_URL=https://parkownia.com` → `docker run -p 3000:3000 -e DATABASE_URL=…`. Postgres+PostGIS stoi na VPS obok kontenera, nie w nim; rozszerzenia z `db/extensions.sql` muszą być założone przed pierwszą migracją. Migracje i seed danych referencyjnych odpala `docker-entrypoint.sh` przy starcie kontenera (`RUN_MIGRATIONS` / `RUN_SEED`; `SEED_DEV` nigdy na produkcji). Do tego: domena, TLS, backupy Postgresa (co noc + test odtworzenia), monitoring (uptime + błędy).

**Done =** obraz zbudowany i wstaje na VPS, produkcja dostępna publicznie, backup odtworzony testowo, wszystkie e2e zielone na prod-buildzie.

> Stan: obraz nie został zbudowany ani razu — demon Dockera nie wstaje w środowisku deweloperskim. Ścieżka deploymentu jest **niezweryfikowana**.

---

## Czego NIE budujemy w MVP (twarda lista — sekcja 11 spec)

- ❌ Aplikacja natywna (PWA wystarczy)
- ❌ Czat host ↔ kierowca
- ❌ System ocen i recenzji (v2)
- ❌ Dynamiczne ceny / algorytmy
- ❌ Integracja ze szlabanami (IoT)
- ❌ Abonamenty miesięczne (model w bazie: tak, UI: nie)
- ❌ Wielomiastowość (schemat gotowy, UI: tylko Poznań)
- ❌ Routing pieszy OSRM/Valhalla (MVP: euklides × 1,3, jawnie oznaczony)
- ❌ Apple/Google Wallet (v2)

Jeśli coś z tej listy zaczyna „wchodzić przy okazji" — to jest scope creep i ma być zatrzymane.
