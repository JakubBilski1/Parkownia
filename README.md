# ParkSpot

Marketplace parkingowy. Agreguje niewykorzystaną podaż miejsc parkingowych
(firmy po godzinach, osoby prywatne, komercyjni operatorzy) i sprzedaje
rezerwacje kierowcom — ze szczególnym naciskiem na wydarzenia masowe w
Poznaniu (mecze Lecha na Enea Stadionie, targi na MTP).

Pełny kontekst projektu: `CLAUDE.md`. Dokumenty źródłowe: `docs/`.

## Wymagania

- **Node.js >= 22** (`engines.node` w `package.json`; `npm run build` na
  starszym Node nie przejdzie)
- **PostgreSQL 14+ z PostGIS** — z Dockera albo własny (patrz niżej)
- Docker + Docker Compose — opcjonalnie, tylko dla ścieżki A

## Szybki start

Aplikację uruchamiasz na hoście (`npm run dev`); różnica między ścieżkami
dotyczy wyłącznie tego, **skąd bierzesz bazę**.

### Ścieżka A — baza z Dockera (najprostsza)

```bash
docker compose -f docker-compose.dev.yml up -d   # Postgres+PostGIS (5432) + MinIO (9000/9001)
cp .env.example .env.local                       # DATABASE_URL już wskazuje na localhost:5432
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

### Ścieżka B — własny Postgres (np. WSL, lokalna instalacja)

```bash
# 1. Baza musi mieć rozszerzenia: postgis, citext, pgcrypto  (db/README.md §2)
# 2. Skonfiguruj połączenie:
cp .env.example .env.local
# 3. PODMIEŃ DATABASE_URL w .env.local na swój host/port, np. Postgres w WSL na 5433:
#    DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot"
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`.env.example` pokazuje port **5432**, bo taki wystawia `docker-compose.yml`.
Jeśli Twój Postgres słucha gdzie indziej (typowo **5433**, żeby nie kolidować
z 5432), **musisz podmienić `DATABASE_URL` w swoim `.env.local`**. To jedyna
wartość, którą trzeba ruszyć.

Aplikacja: http://localhost:3000. Konta testowe (po `db:seed` z `SEED_DEV=1`):
`admin@parkspot.pl`, `host@parkspot.pl`, `firma@parkspot.pl`,
`kierowca@parkspot.pl` — hasło `parkspot123`.

Pełny opis obu ścieżek + Postgres zarządzany (Neon/Supabase/RDS) i
rozwiązywanie problemów: **`db/README.md`**.

## Uruchomienie w kontenerach (app + db + minio)

> ⚠️ **Ta ścieżka nie została ani razu uruchomiona.** `docker compose config`
> waliduje oba pliki, ale demon Dockera nie wstaje w środowisku, w którym
> powstawał ten kod — **obraz nigdy się nie zbudował**. Traktuj poniższe jako
> nieprzetestowane, dopóki nie zbudujesz go u siebie.

```bash
cp .env.example .env             # docker-compose czyta .env, nie .env.local
docker compose up -d --build     # app na :3000, db na :5432, minio na :9000/:9001
npm run db:migrate               # migracje odpalasz z hosta, na localhost:5432
```

Obraz produkcyjny buduje się z `Dockerfile` (multi-stage, Next.js standalone,
non-root). To ta sama ścieżka, którą ma deployować Coolify na VPS.

## Struktura katalogów

```
src/
  app/                # routing + UI (App Router, PL)
  app/api/            # webhooki, scan, sync — cienkie adaptery na moduły
  modules/            # logika domenowa, jedyne miejsce z regułami biznesowymi
    auth/ parkings/ events/ bookings/ payments/ payouts/ notifications/ scan/ admin/
  lib/                # współdzielone: zod-schematy, geocoder, s3, rate-limit
  db/                 # schema Drizzle (index.ts, schema.ts), migracje generowane do drizzle/
  components/
    ui/               # komponenty ogólne
    map/              # MapLibre GL
drizzle/              # migracje SQL wygenerowane przez drizzle-kit
db/
  init/               # SQL uruchamiany raz przy pierwszym starcie kontenera Postgresa
scripts/              # runnery migrate/seed (tsx)
tests/
  unit/               # Vitest, bez bazy
  integration/        # Vitest na żywym PostGIS (osobna baza parkspot_test)
  e2e/                # Playwright
```

Reguła zależności: `app/` → `modules/` → `db/`. Strony nie robią zapytań SQL
bezpośrednio. Szczegóły: `docs/ARCHITECTURE.md` §4.

## Skrypty npm

| Skrypt | Co robi |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | build produkcyjny / start |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | generuje migrację SQL z `src/db/schema.ts` |
| `npm run db:migrate` | aplikuje migracje na `DATABASE_URL` |
| `npm run db:push` | pcha schemat bez migracji (szybka iteracja lokalnie) |
| `npm run db:seed` | seeduje dane dev (venues, eventy, `commission_rules`) |
| `npm test` / `npm run test:watch` | Vitest — **tylko unit**, bez bazy |
| `npm run test:integration` | Vitest na **żywym Postgresie** (osobna baza `parkspot_test`, patrz `TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright (własny serwer na :3200, nie dotyka Twojego `npm run dev`) |

`npm test` celowo **nie** odpala testów integracyjnych: gołe `vitest run`
wymagałoby bazy do przejścia czegoś, co ma być szybkie i offline.

## Dokumenty

- `docs/ARCHITECTURE.md` — architektura i decyzje technologiczne
- `docs/DATA_MODEL.md` — schemat bazy
- `docs/API_SPEC.md` — endpointy
- `docs/PAYMENTS.md` — flow płatności, split, prowizje
- `docs/DESIGN_PRINCIPLES.md` — zasady designu i UX (obowiązkowe przed pracą wizualną)
- `docs/ROADMAP.md` — fazy wdrożenia
- `docs/RISKS.md` — ryzyka

## Stack

Next.js 15 (App Router) · TypeScript (strict) · Tailwind CSS · MapLibre GL JS
+ OpenStreetMap · PostgreSQL 16 + PostGIS · Drizzle ORM · własny JWT (Argon2id)
· MinIO (S3 API) · Stripe · Docker + docker-compose · Vitest + Playwright.