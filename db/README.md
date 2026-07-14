# Baza danych — ParkSpot

ParkSpot wymaga **PostgreSQL 14+ (zalecane 16) z rozszerzeniem PostGIS**.
To nie jest opcjonalne: parkingi i eventy trzymają współrzędne jako
`geography(Point, 4326)` z indeksem GiST, a wyszukiwanie „parkingi w promieniu
X” dzieje się w SQL. Bez PostGIS migracje nie przejdą.

Wymagane rozszerzenia:

| Rozszerzenie | Po co |
|---|---|
| `postgis` | `geography(Point,4326)` + indeksy GiST — zapytania geo |
| `citext` | e-maile bez rozróżniania wielkości liter |
| `pgcrypto` | `gen_random_uuid()` dla kluczy głównych |

Poniżej **trzy ścieżki**. Wybierz jedną — nie mieszaj.

---

## Ścieżka 1: Docker (najprostsza)

Nic nie instalujesz poza Dockerem. Obraz `postgis/postgis:16-3.4` ma PostGIS
w środku, a `db/init/01-extensions.sql` włącza rozszerzenia automatycznie przy
**pierwszym** starcie (mechanizm `docker-entrypoint-initdb.d`).

```bash
# 1. Postawienie bazy i storage'u plików
docker compose -f docker-compose.dev.yml up -d

# 2. Sprawdzenie, że wstały
docker compose -f docker-compose.dev.yml ps

# 3. DATABASE_URL w .env.local
#    DATABASE_URL="postgresql://parkspot:parkspot@localhost:5432/parkspot"

# 4. Migracje + dane startowe
npm run db:migrate
npm run db:seed
```

Parametry połączenia (dev, ustawione w compose):

```
host: localhost   port: 5432
user: parkspot    password: parkspot    database: parkspot
```

Dane leżą w nazwanym wolumenie `parkspot-db-data` i przeżywają restart
kontenera. `docker compose -f docker-compose.dev.yml down -v` je kasuje.

Weryfikacja, że PostGIS naprawdę działa:

```bash
docker compose -f docker-compose.dev.yml exec db \
  psql -U parkspot -d parkspot -c "SELECT postgis_version();"
```

> Chcesz uruchomić także aplikację w kontenerze (nie przez `npm run dev`)?
> `cp .env.example .env && docker compose up -d --build` — pełny stack z
> `docker-compose.yml`. Migracje i tak odpalasz z hosta (`npm run db:migrate`).

---

## Ścieżka 2: własny Postgres (WSL, lokalna instalacja, inny kontener)

**To jest ścieżka aktualnie używana w tym repo** — `.env.local` wskazuje na
Postgresa w WSL, na porcie **5433** (żeby nie kolidować z ewentualnym
Postgresem/Dockerem na 5432).

### 2.1. Zainstaluj Postgresa z PostGIS

```bash
# Ubuntu / Debian / WSL
sudo apt update
sudo apt install -y postgresql-16 postgresql-16-postgis-3
```

Sam `postgresql-16` **nie wystarczy** — pakiet `postgresql-16-postgis-3` musi
być zainstalowany, inaczej `CREATE EXTENSION postgis` zwróci błąd.

### 2.2. (opcjonalnie) Zmień port, jeśli 5432 jest zajęty

W `/etc/postgresql/16/main/postgresql.conf`:

```
port = 5433
```

potem `sudo service postgresql restart`.

### 2.3. Załóż użytkownika i bazę

```bash
sudo -u postgres psql -c "CREATE USER parkspot WITH PASSWORD 'parkspot';"
sudo -u postgres psql -c "CREATE DATABASE parkspot OWNER parkspot;"
```

### 2.4. Włącz rozszerzenia **w bazie `parkspot`**

Wymaga uprawnień superusera, dlatego przez `postgres`, nie przez `parkspot`:

```bash
sudo -u postgres psql -d parkspot -f db/init/01-extensions.sql
```

albo ręcznie:

```sql
\c parkspot
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

### 2.5. Ustaw `DATABASE_URL` w `.env.local`

```
DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot"
```

Port **5433**, jeśli poszedłeś za punktem 2.2. Zostaw **5432**, jeśli nie
zmieniałeś portu. `.env.example` pokazuje 5432 (wartość dla ścieżki dockerowej)
— przy własnym Postgresie na innym porcie **podmieniasz `DATABASE_URL` u siebie
w `.env.local`**, a nie w `.env.example`.

### 2.6. Sprawdź, że wszystko gra

```bash
psql "postgresql://parkspot:parkspot@localhost:5433/parkspot" -c "SELECT postgis_version();"
```

Poprawna odpowiedź to np. `3.6 USE_GEOS=1 USE_PROJ=1 USE_STATS=1`. Jeśli
zamiast tego widzisz `ERROR: function postgis_version() does not exist` —
rozszerzenie nie jest włączone w **tej** bazie (wróć do 2.4).

### 2.7. Migracje i seed

```bash
npm run db:migrate
npm run db:seed
```

> MinIO (zdjęcia parkingów) nadal możesz wziąć z Dockera:
> `docker compose -f docker-compose.dev.yml up -d minio minio-init`.
> Bez MinIO działa wszystko poza uploadem zdjęć.

---

## Ścieżka 3: Postgres zarządzany (Neon / Supabase / RDS)

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

1. **PostGIS musi być włączony w tej konkretnej bazie**, nie „gdzieś na
   serwerze”. Zweryfikuj `SELECT postgis_version();` po połączeniu.
2. **SSL.** Większość managed hostów wymaga TLS. Dopisz parametr do
   connection stringa:
   ```
   DATABASE_URL="postgresql://user:pass@host:5432/parkspot?sslmode=require"
   ```
3. **Pooler vs. połączenie bezpośrednie.** Rezerwacje używają transakcji z
   `SELECT ... FOR UPDATE` (blokada wiersza — patrz `CLAUDE.md`, „sprzedaż tego
   samego miejsca dwa razy”). Pooler w trybie *transaction* to obsłuży, ale
   migracje (`npm run db:migrate`) puszczaj po **bezpośrednim** połączeniu
   (Neon: „direct connection”, Supabase: port 5432, nie 6543).
4. **`citext` i `pgcrypto`** też muszą być dostępne — na managed zwykle są,
   ale sprawdź razem z PostGIS.
5. Nie ma tam `db/init/` — rozszerzenia włączasz **ręcznie**, raz:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS citext;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

---

## MinIO (zdjęcia parkingów)

```bash
docker compose -f docker-compose.dev.yml up -d minio minio-init
```

- API S3: http://localhost:9000
- Konsola: http://localhost:9001 (`parkspot` / `parkspot-dev-secret`)

Usługa `minio-init` zakłada bucket `parkspot-dev` i ustawia na nim publiczny
odczyt — bez niej upload zadziała, ale linki do zdjęć zwrócą 403. To jedyny
krok, którego kod aplikacji **nie** robi za Ciebie.

---

## Migracje i seed

```bash
npm run db:generate   # generuje SQL migracji z src/db/schema.ts (tylko po zmianie schematu)
npm run db:migrate    # aplikuje migracje z drizzle/ na DATABASE_URL
npm run db:seed       # venues, eventy, commission_rules + (przy SEED_DEV=1) dane testowe
```

Skrypty czytają `.env.local` (`--env-file=.env.local`), więc `DATABASE_URL`
musi tam być poprawny — nie wystarczy `export` w shellu.

Seed z `SEED_DEV=1` (domyślnie w `.env.example`) dokłada ~20 parkingów
testowych i po jednym koncie na rolę, hasło `parkspot123`:

```
admin@parkspot.pl · host@parkspot.pl · firma@parkspot.pl · kierowca@parkspot.pl
```

**Nigdy nie ustawiaj `SEED_DEV=1` na produkcji** — tworzy konta ze znanym hasłem.

---

## Rozwiązywanie problemów

### Port zajęty

```
Error: bind: address already in use   (albo: port is already allocated)
```

Coś już słucha na 5432 — najczęściej lokalny Postgres zainstalowany w systemie
albo poprzedni kontener.

```bash
# kto trzyma port (Linux/WSL)
sudo ss -lptn 'sport = :5432'
# Windows (PowerShell)
netstat -ano | findstr :5432
```

Masz dwa wyjścia:

- **Używaj tego, co już działa** → nie startuj usługi `db` z compose, tylko
  wskaż `DATABASE_URL` na istniejącą bazę (Ścieżka 2). Pamiętaj o rozszerzeniach.
- **Przenieś jedno z nich na inny port** → np. Postgres w WSL na 5433
  (punkt 2.2) i wtedy `DATABASE_URL=...@localhost:5433/parkspot`.

Jeśli to stary kontener ParkSpota: `docker compose down` (bez `-v`, żeby nie
skasować danych).

### `ERROR: could not open extension control file ... postgis.control`

PostGIS **nie jest zainstalowany** na serwerze Postgresa (nie mylić z „nie jest
włączony w bazie”). Doinstaluj pakiet:

```bash
sudo apt install -y postgresql-16-postgis-3   # dopasuj wersję do swojego Postgresa
```

Wersja pakietu PostGIS musi pasować do wersji Postgresa — `postgresql-16-postgis-3`
dla PG 16. Po instalacji ponów `CREATE EXTENSION postgis;`.

W obrazie `postgis/postgis` ten błąd nie wystąpi. Jeśli mimo to widzisz brak
rozszerzenia — najpewniej użyłeś zwykłego obrazu `postgres`, nie `postgis/postgis`.

### `ERROR: type "geography" does not exist` / `function postgis_version() does not exist`

PostGIS jest na serwerze, ale nie jest włączony **w tej bazie**. Rozszerzenia są
per-baza:

```bash
sudo -u postgres psql -d parkspot -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Częsty wariant: `db/init/01-extensions.sql` **nie odpalił się**, bo wolumen
`parkspot-db-data` już istniał z wcześniejszego uruchomienia — skrypty z
`docker-entrypoint-initdb.d` wykonują się tylko przy **pustym** wolumenie. Albo
włącz rozszerzenia ręcznie (komenda wyżej), albo zacznij od zera:

```bash
docker compose -f docker-compose.dev.yml down -v   # UWAGA: kasuje dane
docker compose -f docker-compose.dev.yml up -d
```

### `password authentication failed for user "parkspot"`

- Literówka w haśle w `DATABASE_URL` (albo znak specjalny wymagający
  URL-encode: `@` → `%40`, `#` → `%23`).
- Łączysz się do **innego** Postgresa niż myślisz — kontener na 5432 vs. WSL na
  5433. Sprawdź port w `DATABASE_URL`.
- Użytkownik nie istnieje (Ścieżka 2, punkt 2.3).
- Postgres w WSL domyślnie ma `peer` auth dla połączeń lokalnych po socketcie;
  po TCP (`localhost:5433`) obowiązuje `pg_hba.conf` — wpis dla `host ... md5`
  lub `scram-sha-256` musi tam być.

### `ECONNREFUSED 127.0.0.1:5432`

Nic nie słucha na tym porcie. Baza nie wstała (`docker compose ps`), albo w
`.env.local` masz zły port (patrz wyżej: 5432 = Docker, 5433 = WSL w tym repo).

### `relation "users" does not exist`

Migracje nie zostały zaaplikowane na tę bazę: `npm run db:migrate`.
