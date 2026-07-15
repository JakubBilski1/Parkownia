# DATA_MODEL.md — Parkownia

Pełny schemat bazy: PostgreSQL 16 + PostGIS, Drizzle ORM (typy `geography` przez `customType` + raw SQL).

Konwencje globalne:
- **Pieniądze: grosze jako `integer`.** Nigdy float, nigdy `numeric` z groszami po przecinku w kodzie aplikacji.
- **Czas: `timestamptz`, zawsze UTC.** Konwersja na `Europe/Warsaw` tylko w prezentacji.
- **Współrzędne: `geography(Point, 4326)`** z indeksem GiST.
- Klucze główne: `uuid` (`gen_random_uuid()`), nazwy tabel/kolumn: `snake_case`.
- Każda tabela: `created_at`, `updated_at` (`timestamptz`, default `now()`).
- Enumy jako Postgres `enum` (Drizzle `pgEnum`) — walidowane też w Zod na wejściu.

---

## 1. Diagram relacji

```
users ──┬──< user_roles
        ├──< refresh_tokens
        ├──< consents
        ├──< business_profiles (1:0..1)
        ├──< parkings >── venues? (nie — parking jest niezależny)
        └──< bookings

parkings ──┬──< parking_photos
           ├──< parking_availability_windows   (MANUAL)
           ├──< parking_blackout_dates
           ├──< event_parking_availability >── events >── venues
           ├──< event_price_overrides      >── events
           └──< bookings ──┬── payments ──< webhook_events (luźno, po provider_ref)
                           ├──< booking_scans
                           └── payouts (agregat per host+okres) ── payout_items >── bookings

commission_rules   (globalne / per user / per parking)
refund_policies    (globalna, wersjonowana)
notification_log   (audyt wysyłek, bez PII w treści)
```

---

## 2. Użytkownicy i role

### `users`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| email | citext UNIQUE NOT NULL | |
| phone | text | E.164; wymagany przed pierwszą rezerwacją (SMS z kodem) |
| password_hash | text | Argon2id; NULL dla kont utworzonych „przy okazji płatności" do czasu ustawienia hasła |
| first_name, last_name | text | |
| email_verified_at | timestamptz | |
| deleted_at | timestamptz | soft delete = anonimizacja (patrz §10 RODO) |

### `user_roles`
| kolumna | typ | uwagi |
|---|---|---|
| user_id | uuid FK → users | |
| role | enum `role`: DRIVER, HOST_INDIVIDUAL, HOST_BUSINESS, ADMIN | |
| granted_at | timestamptz | |

PK złożony `(user_id, role)`. **Tablica ról, nie pole enum** — jeden użytkownik jest jednocześnie DRIVER i hostem; upgrade do hosta = INSERT wiersza, nie migracja konta.

### `business_profiles` (dla HOST_BUSINESS)
| kolumna | typ | uwagi |
|---|---|---|
| user_id | uuid PK FK → users | 1:1 |
| nip | char(10) UNIQUE NOT NULL | suma kontrolna walidowana lokalnie przed strzałem do API |
| company_name | text NOT NULL | z Białej Listy, edytowalne ręcznie |
| address | text | |
| vat_status | text | z Białej Listy (np. „Czynny") |
| whitelist_checked_at | timestamptz | kiedy ostatnio zweryfikowano |
| whitelist_bank_accounts | jsonb | konta zgłoszone do US — do weryfikacji `payout_bank_account` |
| regon, legal_form, pkd | text/jsonb | opcjonalne wzbogacenie z GUS BIR1; brak odpowiedzi GUS nie blokuje rejestracji |

### `refresh_tokens`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| token_hash | text UNIQUE | przechowujemy hash, nie token |
| family_id | uuid | rotacja: ponowne użycie zużytego tokenu → unieważnienie całej rodziny |
| expires_at, used_at, revoked_at | timestamptz | |

### `consents` (RODO)
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| kind | enum: TERMS, PRIVACY, MARKETING_EMAIL, MARKETING_SMS | |
| document_version | text | wersjonowane treści zgód |
| granted_at, withdrawn_at | timestamptz | |

---

## 3. Parkingi

### `parkings`
Pola obowiązkowe przy publikacji (**5**): `title`, `location`, `capacity`, co najmniej jedna cena, `owner_type`. Wszystko inne nullable — formularz zapisuje `DRAFT` po każdym kroku (autosave), walidacja kompletu dopiero przy przejściu do `PENDING_REVIEW`.

| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid FK → users NOT NULL | |
| owner_type | enum: INDIVIDUAL, BUSINESS | wpływa na domyślną prowizję |
| status | enum: DRAFT, PENDING_REVIEW, ACTIVE, PAUSED, REJECTED | nowy parking → PENDING_REVIEW po wypełnieniu |
| rejection_reason | text | wymagany przy REJECTED |
| **title** | text | obowiązkowe |
| description | text | markdown |
| **location** | geography(Point,4326) | obowiązkowe; **GiST** |
| address | text | z geokodera, edytowalny |
| **capacity** | integer CHECK > 0 | obowiązkowe |
| parking_type | enum: OUTDOOR_LOT, UNDERGROUND, GARAGE, DRIVEWAY, STREET_ADJACENT, MULTI_STOREY | |
| access_type | enum: OPEN, BARRIER_CODE, BARRIER_REMOTE, GATE_MANUAL, LPR, KEY_HANDOVER, ATTENDANT | |
| access_instructions | text | **widoczne dopiero po opłaceniu rezerwacji** — egzekwowane w warstwie API, nigdy nie trafia do publicznych odpowiedzi |
| entrance_location | geography(Point,4326) | **wjazd ≠ parking**; GiST; nawigacja prowadzi tu |
| entrance_notes | text | „wjazd od ul. Górczyńskiej, nie od Głogowskiej" |
| surface | enum: ASPHALT, PAVING, CONCRETE, GRAVEL, GRASS, DIRT | |
| is_covered, is_guarded, has_cctv, is_lit, is_fenced | boolean | NULL = „nie podano" (odróżniamy od „nie") |
| max_vehicle_height_cm | integer | filtr **przed** sprzedażą, nie tłumaczenie po fakcie |
| max_vehicle_length_cm | integer | kampery (Caravans Salon) |
| vehicle_types | enum[] : CAR, SUV, VAN, MOTORCYCLE, CAMPER, TRAILER, BICYCLE | |
| has_ev_charging | boolean | |
| ev_connector_types | enum[] : TYPE2, CCS, CHADEMO, SCHUKO | |
| has_disabled_access | boolean | |
| disabled_spots_count | integer | |
| availability_mode | enum: ALWAYS, RECURRING_SCHEDULE, EVENT_ONLY, MANUAL | |
| schedule | jsonb | struktura niżej; tylko dla RECURRING_SCHEDULE |
| price_per_hour_gr | integer | ≥1 cena wymagana do publikacji |
| price_per_day_gr | integer | |
| price_per_month_gr | integer | abonamenty: model tak, UI nie (MVP) |
| price_per_event_gr | integer | domyślna cena eventowa |
| min_booking_minutes | integer DEFAULT 30 | |
| free_minutes | integer DEFAULT 0 | |
| payout_bank_account | text | IBAN; dla BUSINESS weryfikowany z `whitelist_bank_accounts` |
| profile_completeness | integer 0–100 | liczone przy zapisie; „≥80% → wyższa pozycja" |

Struktura `schedule` (JSONB):
```json
{ "mon": [{"from": "17:00", "to": "24:00"}], "tue": [...], ...,
  "sat": [{"from": "00:00", "to": "24:00"}] }
```
Godziny lokalne `Europe/Warsaw` (harmonogram to pojęcie lokalne — „po pracy"); konwersja na UTC przy rozstrzyganiu dostępności w zapytaniach.

Indeksy: GiST na `location` i `entrance_location`; b-tree na `(status)`, `(owner_id)`; częściowy `(status) WHERE status='PENDING_REVIEW'` dla kolejki moderacji.

### `parking_photos`
`id`, `parking_id` FK, `object_key` (MinIO), `sort_order`, `width`, `height`. Max 10 — CHECK w aplikacji.

### `parking_availability_windows` (tryb MANUAL)
`id`, `parking_id` FK, `starts_at`, `ends_at` (timestamptz), `spots` (NULL = pełna pojemność). Indeks `(parking_id, starts_at, ends_at)`.

### `parking_blackout_dates`
`id`, `parking_id` FK, `date` (date, lokalna), `reason`. Wyłącza dzień mimo harmonogramu.

---

## 4. Eventy

### `venues`
`id`, `name`, `address`, `location` geography(Point,4326) **GiST**, `capacity` int.

### `events`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| venue_id | uuid FK → venues | |
| title, description | text | |
| starts_at, ends_at | timestamptz NOT NULL | |
| category | enum: FOOTBALL, CONCERT, TRADE_FAIR, SPORTS, FESTIVAL, OTHER | |
| expected_attendance | integer | |
| search_radius_meters | integer DEFAULT 1500 | promień nakładki na mapę |

Indeks `(starts_at)` — listowanie nadchodzących.

### `event_parking_availability` (deklaracja hosta)
| kolumna | typ | uwagi |
|---|---|---|
| event_id | uuid FK | PK złożony (event_id, parking_id) |
| parking_id | uuid FK | |
| is_available | boolean NOT NULL | toggle „Udostępniam" |
| spots | integer | może udostępnić 10 z 50; NULL = pełna pojemność |
| price_gr | integer | cena specjalna na ten event; NULL → `price_per_event_gr` parkingu |
| notes | text | „wjazd tylko do 18:30" |
| declared_at | timestamptz | |

### `event_price_overrides`
Pokryte przez `event_parking_availability.price_gr` — **nie tworzymy osobnej tabeli.** Cena eventowa bez deklaracji dostępności nie ma sensu biznesowego.

---

## 5. Rezerwacje

### `bookings`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| code | text UNIQUE NOT NULL | `PK-XXXX-XXXX`, alfabet bez O/0/I/1; generowany przy INSERT |
| code_hash | text NOT NULL | sha256 — to on trafia do manifestów offline |
| parking_id | uuid FK NOT NULL | |
| user_id | uuid FK NOT NULL | konto tworzone „przy okazji" płatności, jeśli nie istnieje |
| event_id | uuid FK NULL | rezerwacja eventowa albo zwykła (od–do) |
| starts_at, ends_at | timestamptz NOT NULL | dla eventowej: okno eventu ± bufor |
| spots | integer DEFAULT 1 | |
| status | enum: PENDING, CONFIRMED, CANCELLED, EXPIRED, USED, NO_SHOW | |
| price_gr | integer NOT NULL | policzone na serwerze w chwili utworzenia |
| commission_rate_pct | integer NOT NULL | **zamrożone** w chwili rezerwacji (zmiana reguły nie zmienia starych rozliczeń) |
| commission_gr, host_payout_gr | integer NOT NULL | wyliczone i zamrożone j.w. |
| vehicle_plate | text | opcjonalnie; przydatne dla LPR w przyszłości |
| pending_expires_at | timestamptz | TTL 15 min dla PENDING |
| cancelled_at | timestamptz, refund_gr integer | wynik polityki zwrotów |

Indeksy: `(parking_id, starts_at, ends_at) WHERE status IN ('PENDING','CONFIRMED','USED')` — zapytanie o zajętość; `(user_id)`, `(event_id)`, UNIQUE `(code)`.

**`USED` należy do tego indeksu.** Auto, które już stoi na placu, zajmuje miejsce najbardziej ze wszystkich. Zapytanie o zajętość liczy `PENDING + CONFIRMED + USED`, a indeks częściowy, którego predykat nie pokrywa zapytania, to indeks, z którego Postgres nie skorzysta — czyli seq scan na ścieżce, która ma nie dopuścić do sprzedania miejsca dwa razy.

### Strategia transakcyjna (nienaruszalna)

```sql
BEGIN;
SELECT id FROM parkings WHERE id = $1 FOR UPDATE;         -- serializacja per parking
-- zajętość w oknie [starts, ends):
SELECT COALESCE(SUM(spots),0) FROM bookings
 WHERE parking_id = $1
   AND starts_at < $ends AND ends_at > $starts
   AND (
     status IN ('CONFIRMED', 'USED')
     OR (status = 'PENDING' AND pending_expires_at > now())
   );
-- limit: LEAST(capacity, spots z event_parking_availability jeśli rezerwacja eventowa)
-- jeśli wolne < żądane → ROLLBACK, 409
INSERT INTO bookings (status='PENDING', pending_expires_at = now() + interval '15 min', ...);
COMMIT;
```

Dwie rzeczy w tym zapytaniu są nieoczywiste i obie kosztowałyby pieniądze:

1. **Nawiasy wokół `OR` nie są kosmetyką.** W poprzedniej wersji tego dokumentu warunek brzmiał `AND status = 'CONFIRMED' OR (status = 'PENDING' AND …) AND …`. `AND` wiąże mocniej niż `OR`, więc całość rozpadała się na „(cokolwiek CONFIRMED, z dowolnego parkingu, z dowolnego okna) OR (…)” — zapytanie liczyłoby cudze rezerwacje i blokowało sprzedaż. Kod (`src/modules/bookings/availability.ts`) był poprawny; błąd był w dokumencie.
2. **`USED` liczy się jako zajęte.** Pominięcie go pozwala przesprzedać parking w trakcie trwania meczu — dokładnie wtedy, gdy komplet aut już stoi za szlabanem.

Blokada wiersza **parkingu** (nie tabeli bookings) serializuje konkurencyjne zakupy tego samego parkingu, a różne parkingi nie czekają na siebie. `EXPIRED` rozstrzygane leniwie warunkiem `pending_expires_at > now()` + cron sprzątający statusy.

### `booking_scans`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK | |
| scanned_by | uuid FK → users | host/obsługa |
| scanned_at | timestamptz | czas skanu (z urządzenia przy offline) |
| synced_at | timestamptz | NULL = jeszcze lokalny |
| result | enum: ADMITTED, REJECTED_USED, REJECTED_INVALID, REJECTED_TIME | |
| offline | boolean | |
| device_id | text | rozstrzyganie konfliktu: pierwszy skan wygrywa, drugi → `conflict=true` |
| conflict | boolean DEFAULT false | |

---

## 6. Płatności (provider-agnostycznie)

Abstrakcja: `provider` + `provider_ref` w każdej tabeli pieniężnej. Przejście z opcji C (ręczne wypłaty) na A (Stripe Connect) = nowy `provider`, zero migracji schematu.

### `payments`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| booking_id | uuid FK UNIQUE | 1:1 z rezerwacją |
| provider | enum: MANUAL, STRIPE, P24, AUTOPAY | |
| provider_ref | text | payment_intent id itp. |
| method | enum: BLIK, CARD | |
| amount_gr | integer NOT NULL | musi się zgadzać z booking.price_gr — webhook porównuje |
| status | enum: INITIATED, PROCESSING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED | |
| refunded_gr | integer DEFAULT 0 | |
| failed_reason | text | |

### `webhook_events` (idempotencja)
| kolumna | typ | uwagi |
|---|---|---|
| provider | enum | PK złożony (provider, event_id) |
| event_id | text | id zdarzenia u providera |
| received_at | timestamptz | |
| payload_hash | text | payloadu NIE logujemy w całości (PII) |
| processed_at | timestamptz | NULL = przyjęty, nieprzetworzony |

INSERT z `ON CONFLICT DO NOTHING` — duplikat webhooka kończy się 200 bez skutków ubocznych.

### `payouts` + `payout_items`
| `payouts` | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| host_id | uuid FK → users | |
| period_start, period_end | date | tygodniowe w opcji C |
| amount_gr | integer | suma items |
| status | enum: PENDING, PAID, FAILED | |
| provider, provider_ref | enum/text | MANUAL: numer przelewu; STRIPE: transfer id |
| paid_at | timestamptz | |

`payout_items`: `payout_id` FK, `booking_id` FK UNIQUE (rezerwacja rozliczana raz), `amount_gr`. Raport wypłat w adminie = `payouts` z `status='PENDING'`.

### `commission_rules`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| scope | enum: GLOBAL_INDIVIDUAL, GLOBAL_BUSINESS, USER, PARKING | |
| user_id / parking_id | uuid FK NULL | dla scope USER/PARKING |
| rate_pct | integer NOT NULL | prowizja platformy |
| valid_from | timestamptz | |

Rozstrzyganie: PARKING > USER > GLOBAL_(owner_type). Seed: GLOBAL_INDIVIDUAL=50, GLOBAL_BUSINESS=30. Stawka **kopiowana do booking** w chwili rezerwacji.

### `refund_policies`
| kolumna | typ | uwagi |
|---|---|---|
| id | uuid PK | |
| name | text | |
| rules | jsonb | `[{"minHoursBefore":24,"refundPct":100},{"minHoursBefore":2,"refundPct":50},{"minHoursBefore":0,"refundPct":0}]` |
| is_default | boolean | |
| valid_from | timestamptz | wersjonowana; booking rozliczany polityką z chwili zakupu (FK `bookings.refund_policy_id`) |

---

## 7. Powiadomienia

### `notification_log`
`id`, `user_id` FK, `channel` enum(EMAIL, SMS), `template` text (np. `booking_confirmed`, `event_host_prompt_7d`), `related_id` uuid, `sent_at`, `status` enum(SENT, FAILED). **Bez treści wiadomości** (PII). Służy też deduplikacji („nie wysyłaj drugi raz zaproszenia na ten event") — UNIQUE `(user_id, template, related_id)`.

Feature flags (SMS on/off) w konfiguracji aplikacji (`.env`), nie w bazie.

---

## 8. Tokeny jednorazowe

### `action_tokens`
`id`, `user_id` FK, `purpose` enum(EVENT_AVAILABILITY, EMAIL_VERIFY, PASSWORD_RESET, DATA_EXPORT), `token_hash` UNIQUE, `payload` jsonb (np. event_id), `expires_at`, `used_at`. Obsługuje „jedno kliknięcie z maila" dla deklaracji hosta.

---

## 9. Rate limiting (bez Redisa)

### `rate_limits`
`key` text PK (np. `auth:1.2.3.4`), `window_start` timestamptz, `count` integer. UPSERT z resetem okna; czyszczone cronem. Wystarczające do skali MVP; wymiana na Redis = wymiana implementacji `src/lib/rate-limit`.

---

## 10. RODO — operacje na danych

- **Eksport:** złożenie żądania → zebranie users + bookings + consents + notification_log do JSON → link ważny 24 h (`action_tokens`, purpose DATA_EXPORT).
- **Usunięcie konta:** `users.deleted_at = now()`, `email → deleted-{id}@anonymized.local`, `phone/first_name/last_name/password_hash → NULL`, refresh tokeny revoked. Rezerwacje i płatności **zostają** (obowiązki rachunkowe) — bez danych osobowych są tylko wierszami rozliczeń.
- Zdjęcia parkingów usuwanego hosta: obiekty MinIO kasowane, parkingi → PAUSED z `deleted_owner=true`.

---

## 11. Seed

- **Venues:** Enea Stadion (Bułgarska 17, 52.3977 N, 16.8581 E), MTP (Głogowska 14, 52.4022 N, 16.9128 E).
- **Events H2 2026:** mecze Lecha: 25.07 Cracovia, 08.08 Piast, 22.08 Jagiellonia, 05.09 Raków, 19.09 Radomiak, 17.10 Korona, 31.10 Wisła Kraków, 07.11 Zagłębie, 28.11 Pogoń; MTP: DREMA 8–11.09, Retro Motor Show 18–20.09, Polagra 23–25.09, Poznań Maraton 04.10, Caravans Salon 8–11.10, Tour Salon 9–11.10, Poznań Game Arena 13–15.11, Cavaliada 10–13.12.
- `commission_rules` globalne (50/30), domyślna `refund_policies`.
- Dev-only: ~20 parkingów testowych wokół obu venues, konta testowe per rola.
