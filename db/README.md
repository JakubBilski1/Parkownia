# Baza danych — ParkSpot

ParkSpot wymaga **PostgreSQL 14+ (zalecane 16) z rozszerzeniem PostGIS**.
To nie jest opcjonalne: parkingi i eventy trzymają współrzędne jako
`geography(Point, 4326)` z indeksem GiST, a wyszukiwanie „parkingi w promieniu
X” dzieje się w SQL. Bez PostGIS **pierwsza migracja nie przejdzie**.

Wymagane rozszerzenia:

| Rozszerzenie | Po co |
|---|---|
| `postgis` | `geography(Point,4326)` + indeksy GiST — zapytania geo |
| `citext` | e-maile bez rozróżniania wielkości liter |
| `pgcrypto` | `gen_random_uuid()` dla kluczy głównych |

**Bazy nie ma w obrazie.** `Dockerfile` buduje wyłącznie aplikację; łączy się ona
z **zewnętrznym** Postgresem przez `DATABASE_URL` — lokalnie z Twoim, na VPS-ie
z tym, który tam już stoi. Postgresa dostarczasz sam, tym dokumentem.

---

## Rozszerzenia — kto je włącza

Definicja: **`db/extensions.sql`** (trzy `CREATE EXTENSION IF NOT EXISTS`).

`scripts/migrate.mjs` puszcza ten plik sam, tuż przed migracjami — więc
`npm run db:migrate` (i start kontenera) załatwia sprawę, **o ile rola z
`DATABASE_URL` ma prawo tworzyć rozszerzenia**. Zwykle nie ma. Wtedy raz, ręcznie,
superuserem:

```bash
psql "$DATABASE_URL" -f db/extensions.sql
```

Rozszerzenia są **per-baza**. Włączenie ich w bazie `postgres` nie włącza ich
w bazie `parkspot`.

---

## Ścieżka 1: własny Postgres (WSL, lokalna instalacja, własny kontener)

**To jest ścieżka używana w tym repo** — Postgres 16 + PostGIS 3.6 w WSL, na
porcie **5433** (żeby nie kolidować z ewentualnym Postgresem na 5432).

### 1.1. Zainstaluj Postgresa z PostGIS

```bash
# Ubuntu / Debian / WSL
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-postgis-3
```

Sam `postgresql-16` **nie wystarczy** — bez pakietu `postgresql-16-postgis-3`
`CREATE EXTENSION postgis` zwróci błąd.

### 1.2. (opcjonalnie) Zmień port, jeśli 5432 jest zajęty

W `/etc/postgresql/16/main/postgresql.conf`:

```
port = 5433
```

potem `sudo service postgresql restart`.

### 1.3. Załóż użytkownika i bazę

```bash
sudo -u postgres psql -c "CREATE USER parkspot WITH PASSWORD 'parkspot';"
sudo -u postgres psql -c "CREATE DATABASE parkspot OWNER parkspot;"
```

### 1.4. Włącz rozszerzenia **w bazie `parkspot`**

Wymaga superusera, dlatego przez `postgres`, nie przez `parkspot`:

```bash
sudo -u postgres psql -d parkspot -f db/extensions.sql
```

### 1.5. Ustaw `DATABASE_URL` w `.env.local`

```bash
cp .env.example .env.local
```

```
DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot"
```

`.env.example` ma w tym miejscu **5432** — to tylko generyczny default. Port
wpisujesz swój (u nas: 5433) i **w `.env.local`**, nie w `.env.example`.

### 1.6. Sprawdź, że PostGIS naprawdę działa

```bash
psql "postgresql://parkspot:parkspot@localhost:5433/parkspot" -c "SELECT postgis_version();"
```

Poprawna odpowiedź to np. `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`. Jeśli widzisz
`ERROR: function postgis_version() does not exist` — rozszerzenie nie jest
włączone w **tej** bazie (wróć do 1.4).

### 1.7. Migracje i seed

```bash
npm run db:migrate
SEED_DEV=1 npm run db:seed
npm run dev
```

---

## Ścieżka 2: Postgres zarządzany (Neon / Supabase / RDS)

Działa, ale tylko wtedy, gdy dostawca **udostępnia PostGIS**. Sprawdź to
**zanim** cokolwiek postawisz — bez PostGIS aplikacja nie ruszy, a nie każdy
managed Postgres go ma.

| Dostawca | PostGIS | Uwagi |
|---|---|---|
| Neon | tak | `CREATE EXTENSION postgis;` działa na zwykłym userze |
| Supabase | tak | włączasz w panelu (Database → Extensions) lub `CREATE EXTENSION` |
| AWS RDS | tak | wymaga roli `rds_superuser` do `CREATE EXTENSION postgis` |
| Cloud SQL (GCP) | tak | rozszerzenie trzeba włączyć jawnie |

Na co uważać:

1. **Rozszerzenia włączasz ręcznie**, raz, rolą z odpowiednimi uprawnieniami —
   `psql "$DATABASE_URL" -f db/extensions.sql`. Rola aplikacyjna zwykle tego nie
   może, więc automat w `scripts/migrate.mjs` się na tym wyłoży (i powie o tym
   wprost, zamiast umrzeć w środku migracji).
2. **PostGIS musi być włączony w tej konkretnej bazie**, nie „gdzieś na
   serwerze”. Zweryfikuj `SELECT postgis_version();` po połączeniu.
3. **SSL.** Większość managed hostów wymaga TLS:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/parkspot?sslmode=require"
   ```
4. **Pooler vs. połączenie bezpośrednie.** Rezerwacje używają transakcji z
   `SELECT ... FOR UPDATE` (blokada wiersza — patrz `CLAUDE.md`, „sprzedaż tego
   samego miejsca dwa razy”). Pooler w trybie *transaction* to obsłuży, ale
   migracje puszczaj po **bezpośrednim** połączeniu (Neon: „direct connection”,
   Supabase: port 5432, nie 6543).
5. **`citext` i `pgcrypto`** też muszą być dostępne — zwykle są, ale sprawdź
   razem z PostGIS.

---

## Migracje i seed

```bash
npm run db:generate   # generuje SQL migracji z src/db/schema.ts (tylko po zmianie schematu)
npm run db:migrate    # db/extensions.sql + migracje z drizzle/ na DATABASE_URL
npm run db:seed       # venues, eventy, commission_rules, polityka zwrotów
```

Skrypty czytają `.env.local` (`--env-file=.env.local`), więc `DATABASE_URL` musi
tam być poprawny — `export` w shellu nie wystarczy.

**Seed nie jest opcjonalny.** `commission_rules` i domyślna polityka zwrotów
powstają właśnie tam; na bazie z samymi migracjami wyliczenie prowizji rzuca
wyjątkiem i **każda** rezerwacja pada. Seed jest idempotentny (stałe id +
`ON CONFLICT DO NOTHING`), można go puszczać wielokrotnie.

`SEED_DEV=1` dokłada ~20 parkingów demo i po jednym koncie na rolę, hasło
`parkspot123`:

```
admin@parkspot.pl · host@parkspot.pl · firma@parkspot.pl · kierowca@parkspot.pl
```

**`SEED_DEV` nigdy nie leci na produkcję** — to konta ze znanym hasłem.

W kontenerze migracje i seed odpalają się same przy starcie
(`docker-entrypoint.sh`, wyłączniki `RUN_MIGRATIONS=false` / `RUN_SEED=false`) —
patrz `README.md`.

---

## Baza testowa (`TEST_DATABASE_URL`)

Testy integracyjne (`npm run test:integration`) chodzą po **żywym** Postgresie i
**czyszczą tabele**. Dlatego muszą mieć własną bazę:

```
TEST_DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot_test"
```

Baza `parkspot_test` **tworzy się sama** przy pierwszym uruchomieniu — setup
zakłada ją, włącza rozszerzenia i puszcza migracje. Rola musi więc móc
`CREATE DATABASE` i tworzyć rozszerzenia. Suite odmówi startu, jeśli
`TEST_DATABASE_URL` wskazuje na to samo, co `DATABASE_URL`. Szczegóły:
`tests/README.md`.

---

## MinIO (zdjęcia parkingów)

Storage jest S3-kompatybilny i konfiguruje się **wyłącznie** zmiennymi `S3_*`.
Nic go za Ciebie nie uruchamia — jak chcesz upload zdjęć lokalnie, odpal MinIO
sam:

```bash
docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"
```

Bucket zakładasz w konsoli (http://localhost:9001) i ustawiasz na nim publiczny
odczyt — bez tego upload przejdzie, ale linki do zdjęć zwrócą 403.

**Bez MinIO działa wszystko poza uploadem zdjęć.**

---

## Rozwiązywanie problemów

### `ECONNREFUSED 127.0.0.1:5432`

Nic nie słucha na tym porcie. Albo Postgres nie stoi (`sudo service postgresql
status`), albo w `.env.local` masz zły port — w tym repo baza siedzi na **5433**,
a `.env.example` niesie 5432.

### Port zajęty

```
Error: bind: address already in use
```

Coś już słucha na 5432 — najczęściej Postgres zainstalowany w systemie albo
jakiś kontener z innego projektu.

```bash
# kto trzyma port (Linux/WSL)
sudo ss -lptn 'sport = :5432'
# Windows (PowerShell)
netstat -ano | findstr :5432
```

Albo używaj tego, co już na tym porcie działa (pamiętaj o rozszerzeniach), albo
przenieś swojego Postgresa na 5433 (punkt 1.2) i popraw `DATABASE_URL`.

### `ERROR: could not open extension control file ... postgis.control`

PostGIS **nie jest zainstalowany na serwerze** (to co innego niż „nie jest
włączony w bazie”). Doinstaluj pakiet:

```bash
sudo apt install -y postgresql-16-postgis-3   # wersja musi pasować do wersji PG
```

Potem ponów `CREATE EXTENSION postgis;`.

### `ERROR: type "geography" does not exist` / `function postgis_version() does not exist`

PostGIS jest na serwerze, ale nie jest włączony **w tej bazie**:

```bash
sudo -u postgres psql -d parkspot -f db/extensions.sql
```

### `ERROR: permission denied to create extension "postgis"`

Rola z `DATABASE_URL` nie ma uprawnień — tak jest na większości managed
Postgresów. Włącz rozszerzenia osobno, rolą superusera
(`rds_superuser` / `cloudsqlsuperuser` / panel dostawcy), i dopiero potem
`npm run db:migrate`.

### `password authentication failed for user "parkspot"`

- Literówka w haśle w `DATABASE_URL` (albo znak specjalny wymagający
  URL-encode: `@` → `%40`, `#` → `%23`).
- Łączysz się do **innego** Postgresa niż myślisz — sprawdź port.
- Użytkownik nie istnieje (punkt 1.3).
- Postgres w WSL ma domyślnie `peer` auth po socketcie; po TCP
  (`localhost:5433`) obowiązuje `pg_hba.conf` — wpis `host ... scram-sha-256`
  musi tam być.

### `relation "users" does not exist`

Migracje nie zostały zaaplikowane na **tę** bazę: `npm run db:migrate`.
Jeśli to nie pomaga — sprawdź, czy `DATABASE_URL` wskazuje na bazę, o której
myślisz.
