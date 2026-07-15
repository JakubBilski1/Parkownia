# Parkownia

Marketplace parkingowy. Agreguje niewykorzystaną podaż miejsc parkingowych
(firmy po godzinach, osoby prywatne, komercyjni operatorzy) i sprzedaje
rezerwacje kierowcom — ze szczególnym naciskiem na wydarzenia masowe w
Poznaniu (mecze Lecha na Enea Stadionie, targi na MTP).

Pełny kontekst projektu: `CLAUDE.md`. Dokumenty źródłowe: `docs/`.

## Wymagania

- **Node.js >= 22** (`engines.node` w `package.json`; `npm run build` na
  starszym Node nie przejdzie)
- **PostgreSQL 14+ z PostGIS** — własny: WSL, lokalna instalacja, kontener,
  managed. Nie ma compose'a, więc bazę przynosisz swoją.
- Docker — tylko do zbudowania obrazu produkcyjnego („Wdrożenie na VPS”)

## Szybki start

Bazy nie dostaniesz z repo — **przynosisz własnego Postgresa**. Aplikację
uruchamiasz na hoście (`npm run dev`).

```bash
# 1. Postgres 14+ z rozszerzeniami: postgis, citext, pgcrypto.
#    Raz, jako superuser, na docelowej bazie:
psql "postgresql://user:pass@localhost:5433/parkownia" -f db/extensions.sql

# 2. Konfiguracja
cp .env.example .env.local
#    PODMIEŃ DATABASE_URL na swój host/port — np. Postgres w WSL na 5433:
#    DATABASE_URL="postgresql://parkownia:parkownia@localhost:5433/parkownia"

npm install
npm run db:migrate
npm run db:seed
npm run dev
```

`DATABASE_URL` to jedyna wartość, którą trzeba ruszyć. `.env.example` pokazuje
port **5432**; baza tego repo chodzi w WSL na **5433** (żeby nie kolidować
z 5432) — wpisz to, na czym faktycznie słucha Twój Postgres.

`db:migrate` sam próbuje wykonać `db/extensions.sql` przed migracjami, ale
`CREATE EXTENSION` wymaga superusera — na bazie, gdzie rola aplikacji go nie ma,
zrobisz to krokiem 1 i tylko raz.

Aplikacja: http://localhost:3000. `db:seed` wgrywa dane referencyjne
(`commission_rules`, polityka zwrotów, 2 obiekty, 17 eventów), a przy
`SEED_DEV=1` (domyślnie w `.env.example`) dokłada parkingi demo i konta testowe:
`admin@parkspot.pl`, `host@parkspot.pl`, `firma@parkspot.pl`,
`kierowca@parkspot.pl` — hasło `parkspot123`.

**MinIO (zdjęcia parkingów) nie wstaje już z compose'a.** Storage jest
S3-kompatybilny i konfiguruje się wyłącznie zmiennymi `S3_*`. Chcesz uploadu
zdjęć lokalnie — uruchamiasz MinIO sam:

```bash
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

Bez niego działa wszystko **poza** uploadem zdjęć.

Postgres zarządzany (Neon/Supabase/RDS) i rozwiązywanie problemów:
**`db/README.md`**.

## Wdrożenie na VPS

Jednostką deploymentu jest **jeden obraz produkcyjny** z `Dockerfile`. Nie ma
compose'a i nie ma osobnego joba migracyjnego. **Bazy nie ma w obrazie** —
aplikacja łączy się przez `DATABASE_URL` do Postgresa, który już stoi na VPS-ie.

> **Warunek konieczny:** ta zewnętrzna baza musi mieć rozszerzenia **postgis,
> citext, pgcrypto**. Bez PostGIS wywala się pierwsza migracja — całe wyszukiwanie
> geo stoi na `geography(Point,4326)` i indeksie GiST. Raz, jako superuser:
> `psql "$DATABASE_URL" -f db/extensions.sql`.

```bash
docker build -t parkownia --build-arg NEXT_PUBLIC_APP_URL=https://parkownia.com .

docker run -d --name parkownia -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/parkownia" \
  -e JWT_ACCESS_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e ACTION_TOKEN_SECRET="..." \
  -e PAYMENT_PROVIDER="stripe" \
  -e STRIPE_SECRET_KEY="..." \
  -e STRIPE_WEBHOOK_SECRET="..." \
  parkownia
```

**`NEXT_PUBLIC_APP_URL` jest build-argiem, nie zmienną runtime'u.** Next wkleja
`NEXT_PUBLIC_*` do bundla przeglądarki na etapie builda. Zły adres przy budowaniu
= złe linki absolutne (powroty z płatności, linki w mailach) w wysłanym JS-ie,
a żadne `-e` przy `docker run` już tego nie odkręci — trzeba przebudować obraz.

Reszta zmiennych (S3, e-mail, SMS, geokoder, `CRON_SECRET`) — pełna lista
z opisami w `.env.example`.

### Co robi kontener przy starcie

`docker-entrypoint.sh`, zanim odda ruch do `node server.js`:

1. **przerywa start**, jeśli `DATABASE_URL` nie jest ustawione;
2. aplikuje migracje — `node scripts/migrate.mjs` (wyłącznik: `RUN_MIGRATIONS=false`);
3. wgrywa dane referencyjne — `node dist/seed.mjs` (wyłącznik: `RUN_SEED=false`).

Oba kroki są idempotentne. Seed **nie jest** devowym hałasem: bez
`commission_rules` `resolveCommissionRatePct` (`src/modules/payouts/service.ts`)
rzuca wyjątkiem, więc na bazie z samymi migracjami **każda** rezerwacja by padła.
Seed wgrywa reguły prowizji (50% os. prywatne / 30% firmy), politykę zwrotów,
2 obiekty i 17 eventów. `SEED_DEV` nie jest tu ustawiane nigdy — konta testowe
i parkingi demo nie trafiają na produkcję.

Efekt uboczny, wprost: seed przelatuje przy **każdym** starcie, więc event
skasowany w panelu admina wróci po restarcie. Gdy zaczniesz zarządzać eventami
z panelu, ustaw `RUN_SEED=false`.

Obraz: multi-stage (`deps` → `builder` → `runner`, wysyłany jest tylko `runner`),
Next.js standalone, non-root (uid 1001), `EXPOSE 3000`, HEALTHCHECK na `/`.

> Skalujesz ponad jedną replikę? Dwa kontenery startujące równocześnie migrowałyby
> jednocześnie. Wtedy `RUN_MIGRATIONS=false` i migracja jako osobny krok.

> Obraz nie został zbudowany w środowisku, w którym powstawał ten kod (demon
> Dockera tam nie wstaje). Pierwszy `docker build` u siebie jest jednocześnie
> pierwszą weryfikacją tej ścieżki.

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
  extensions.sql      # postgis, citext, pgcrypto — raz, na docelowej bazie
scripts/              # migrate.mjs (goły ESM — jedzie też w kontenerze), seed.ts
Dockerfile            # obraz produkcyjny (deps → builder → runner)
docker-entrypoint.sh  # migracje + seed przed startem serwera w kontenerze
tests/
  unit/               # Vitest, bez bazy
  integration/        # Vitest na żywym PostGIS (osobna baza parkownia_test)
  e2e/                # Playwright
```

Reguła zależności: `app/` → `modules/` → `db/`. Strony nie robią zapytań SQL
bezpośrednio. Szczegóły: `docs/ARCHITECTURE.md` §4.

## Skrypty npm

| Skrypt | Co robi |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` / `npm run start` | build produkcyjny / start |
| `npm run build:seed` | bunduje `scripts/seed.ts` do `dist/seed.mjs` (esbuild, ESM bez `tsx`) — używa tego obraz, żeby seed dał się odpalić na produkcji |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | generuje migrację SQL z `src/db/schema.ts` |
| `npm run db:migrate` | `node --env-file=.env.local scripts/migrate.mjs` — aplikuje migracje na `DATABASE_URL` |
| `npm run db:push` | pcha schemat bez migracji (szybka iteracja lokalnie) |
| `npm run db:seed` | dane referencyjne (obiekty, eventy, `commission_rules`); z `SEED_DEV=1` także konta testowe i parkingi demo |
| `npm test` / `npm run test:watch` | Vitest — **tylko unit**, bez bazy |
| `npm run test:integration` | Vitest na **żywym Postgresie** (osobna baza `parkownia_test`, patrz `TEST_DATABASE_URL`) |
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
· storage S3-kompatybilny (lokalnie MinIO) · Stripe · Docker (jeden obraz
produkcyjny) · Vitest + Playwright.