# API_SPEC.md — Parkownia

Kontrakt API. Dwie ścieżki wejścia (obie przez te same moduły domenowe i tę samą walidację Zod):
- **Server Actions** — formularze naszego frontu (rejestracja, dodanie parkingu, deklaracja hosta).
- **API Routes (`app/api/…`)** — wszystko, co woła klient inny niż nasz React: webhooki PSP, skaner, sync offline, mapa (fetch z klienta).

Zasady globalne:
- Walidacja **Zod na wejściu każdego** endpointu/akcji, po stronie serwera.
- Kwoty i dostępność liczone wyłącznie na serwerze; `amount` z frontu nie istnieje w kontrakcie.
- Autoryzacja: access JWT (Bearer / cookie) 15 min; refresh 7 dni httpOnly. Role sprawdzane per endpoint.
- Odpowiedzi błędów, jednolity kształt: `{ "error": { "code": "SLOT_TAKEN", "message": "…po polsku, dla usera…" } }`.
- Kody: 400 walidacja, 401 brak/zły token, 403 zła rola, 404, 409 konflikt (dostępność, duplikat), 422 reguła biznesowa, 429 rate limit.
- Paginacja list: `?cursor=…&limit=…` (cursor-based), odpowiedź `{ items, nextCursor }`.

Rate limity (okno stałe w Postgresie, `src/lib/rate-limit.ts`; klucz w nawiasie):
| Obszar | Limit |
|---|---|
| POST /auth/* (IP) | 5/min |
| POST /bookings, /payments (user) | 10/min |
| GET /business/nip-lookup (user) | 3/min |
| POST /scan/* (user) | 60/min (kolejka przy bramie) |
| GET /map/* (IP) | 120/min |
| GET /geocode (user) | 30/min |
| POST /me/data-export (user) | 3/h |

`/auth/refresh` **nie jest** limitowany: limit na odświeżaniu tokenu wywracałby normalną nawigację zalogowanego użytkownika. `/map/*` i `/geocode` są limitowane, bo są publiczne (albo tanie) i uruchamiają zapytania PostGIS oraz płatne API zewnętrzne — to najtańszy sposób, żeby kazać naszej bazie pracować za darmo.

---

## 1. Auth

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| POST | `/api/auth/register` | **admin** | `{email, password, firstName?, lastName?, consents: {terms: true, privacy: true, marketingEmail?: bool}}` → 201 `{user}`. Rola startowa: DRIVER. **Samodzielna rejestracja jest wyłączona** (decyzja właściciela, 2026-07-26): strony `/rejestracja` nie ma, a endpoint odpowiada 401/403 każdemu, kto nie jest adminem. **Nie ustawia już ciasteczek sesji** — admin zakładający konto klientowi nie może zostać z niego wylogowany. Wróci jako publiczny; wtedy przywraca się też ustawianie sesji. |
| POST | `/api/auth/login` | publiczny | `{email, password}` → 200 `{user, accessToken}` + cookie. 401 bez rozróżniania „zły mail/hasło". |
| POST | `/api/auth/refresh` | cookie | Rotacja refresh tokenu. Ponowne użycie zużytego → 401 + unieważnienie rodziny tokenów. |
| GET | `/api/auth/refresh?next=…` | cookie | **Nawigacyjny wariant tego samego.** Middleware działa na Edge i nie ma dostępu do bazy, więc nie potrafi zrotować tokenu — odbija tu sesję wygasłą-ale-odnawialną i wraca na `next` (walidowane: wyłącznie ścieżki względne). Bez tego host z otwartą kartą leci na ekran logowania co 15 minut. |
| POST | `/api/auth/logout` | user | Revoke refresh, czyści cookie. |

**Access token jedzie też w cookie `ps_access` (httpOnly), nie tylko w body.** ARCHITECTURE §3 mówi „pamięć klienta"; to nie wystarcza, bo strony RSC, server actions i middleware nie mają czego czytać — a panel hosta i admina to w całości RSC. Nazwy ciasteczek: `ps_access`, `ps_refresh` (`src/modules/auth/cookie-names.ts`).
| POST | `/api/auth/password-reset` / `…/confirm` | publiczny | Standard: mail z tokenem (`action_tokens`), odpowiedź zawsze 200 (bez ujawniania istnienia konta). |
| POST | `/api/auth/upgrade-to-host` | user | `{hostType: 'INDIVIDUAL'}` → dodaje rolę HOST_INDIVIDUAL. Dla BUSINESS patrz §2. |

## 2. Rejestracja firmowa (HOST_BUSINESS)

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| GET | `/api/business/nip-lookup?nip=…` | user | 1. lokalna suma kontrolna NIP (błędna → 400 bez strzału do API), 2. Biała Lista `wl-api.mf.gov.pl/api/search/nip/{nip}?date={today}` → `{companyName, address, vatStatus, bankAccounts[]}`, 3. best-effort GUS BIR1 (`regon, legalForm, pkd`) — timeout 3 s, brak nie blokuje. 503 gdy Biała Lista leży → front pozwala wpisać ręcznie. |
| POST | `/api/business/profile` | user | `{nip, companyName, address, …}` (dane z lookupu, **edytowalne**) → tworzy `business_profiles`, dodaje rolę HOST_BUSINESS. |

## 3. Parkingi

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| POST | `/api/parkings` | host | Tworzy DRAFT. Body: dowolny podzbiór pól modelu (autosave). → 201 `{id, status: 'DRAFT'}`. |
| PATCH | `/api/parkings/:id` | właściciel | Częściowa aktualizacja (autosave każdego kroku formularza). Przelicza `profileCompleteness`. |
| POST | `/api/parkings/:id/submit` | właściciel | Walidacja 5 pól obowiązkowych (w tym ≥1 cena) → PENDING_REVIEW, 422 z listą braków. |
| POST | `/api/parkings/:id/pause` / `:id/resume` | właściciel | ACTIVE ↔ PAUSED. |
| GET | `/api/parkings/mine` | host | Lista własnych parkingów ze statusami. |
| GET | `/api/parkings/:id` | publiczny | Karta parkingu. **Nigdy nie zawiera** `access_instructions` ani `payout_bank_account` (zweryfikowane testem z podstawionym kanarkiem, `tests/integration/data-leak.test.ts`). Dystans pieszo: `distanceMeters` + `isApproximate: true` (euklides × 1,3 w MVP); `null`, gdy request nie podał punktu odniesienia. **`priceUnit` to tu gotowy string do wyświetlenia (`"za godzinę"`), a nie enum** — inaczej niż w `/api/map/parkings`, gdzie leci `"HOUR"`. Ta sama nazwa, dwa kształty: pin renderuje się sam, karta dostaje tekst. |
| POST | `/api/parkings/:id/photos` | właściciel | → `{uploadUrl, objectKey}` (presigned MinIO, max 10 zdjęć). Po uploadzie: POST potwierdzenie z `objectKey`. |

### Mapa (żądania z klienta, częste — muszą być tanie)

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/map/parkings?bbox=west,south,east,north&filters…` | Tylko ACTIVE w viewporcie: `ST_Intersects(location, ST_MakeEnvelope(...))` na GiST. Zwraca lekkie piny: `{id, lat, lng, priceGr, priceUnit, ownerType, isCovered}` + `{limit, truncated}`. Filtry: `maxPriceGr, parkingType[], isCovered, isGuarded, minHeightCm, accessType[], availableFrom, availableTo, spots`. Limit 500 pinów; front klastruje (supercluster). Debounce 300 ms po stronie klienta. |
| GET | `/api/map/nearby?lat=…&lng=…&radius=…` | `ST_DWithin(location, punkt, radius)` — „parkingi w pobliżu" z geolokalizacji. Dokłada `walkDistanceMeters`, `walkMinutes`, `isApproximate: true`. |
| GET | `/api/geocode?q=…` (lub `?lat=&lng=`) | Proxy do geokodera (Nominatim dev / Geoapify prod) — klucz zostaje na serwerze, wyniki cache'owane. **Wymaga zalogowania:** otwarty geokoder to cudzy limit do przepalenia. |

`priceUnit` jedzie z pinem, bo cena bez jednostki kłamie: „35 zł" za godzinę i „35 zł" za mecz to dwie różne oferty, a pin ma 60 px i nie ma miejsca na przypis.

Filtr dostępności terminowej (`availableFrom/To`) rozstrzyga: `availability_mode` + `schedule`/okna MANUAL + blackouty + zajętość z `bookings` — w SQL, nie w JS.

## 4. Eventy

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| GET | `/api/events?upcoming=true` | publiczny | Lista nadchodzących (Poznań = wszystkie w MVP). |
| GET | `/api/events/:id` | publiczny | Szczegóły + venue. |
| GET | `/api/events/:id/parkings` | publiczny | Parkingi w `search_radius_meters` od venue (`ST_DWithin`), dostępne w oknie eventu, z ceną eventową (`event_parking_availability.price_gr` → fallback `price_per_event_gr`). Sort: dystans. Kształt odpowiedzi: `{event, isApproximate: true, items[]}`; każdy item ma `straightLineMeters`, `walkMeters`, `walkMinutes`, `freeSpots`, `declaredByHost`, `hostNotes`. **`isApproximate` jest na poziomie odpowiedzi, nie itemu** — to własność metody (euklides × 1,3), nie pojedynczego wiersza. |

**Kto jest na tej liście — i dlaczego dokładnie ci sami są kupowalni (`src/modules/events/parkings.ts`, `src/modules/bookings/availability.ts`):**

```
sprzedawalny = NIE w blackoucie
               AND ( host zadeklarował ten event na „tak"
                     OR ( brak deklaracji AND availability_mode parkingu
                          pokrywa całe okno eventu ) )
```

- Deklaracja „tak" **bije** harmonogram (jest nowszą, bardziej szczegółową decyzją hosta) i ustala cenę oraz liczbę miejsc.
- Deklaracja „nie tym razem" **bije wszystko** — parking znika z listy i nie da się go kupić.
- **Brak deklaracji to nie jest „nie".** Całodobowy garaż 400 m od stadionu sprzedaje w dzień meczu bez żadnego kliknięcia operatora — dokładnie tak, jak obiecuje lista kierowcy.

Ta reguła musi być **jedna**. Lista i transakcja kupna liczyły ją kiedyś osobno i się rozjechały: lista pokazywała parking, `POST /api/bookings` odpowiadał 422. Predykaty żyją w `src/modules/parkings/availability.ts` i są wołane z obu miejsc.
| GET | `/api/host/events` | host | Nadchodzące eventy w promieniu parkingów hosta + status deklaracji. |
| PUT | `/api/host/events/:eventId/availability` | host | `{parkingId, isAvailable, spots?, priceGr?, notes?}` → upsert `event_parking_availability`. |
| POST | `/api/host/events/quick-declare` | token z maila | Body: `{token, accept: bool, spots?, priceGr?}` — ścieżka „jedno kliknięcie z maila" (`action_tokens`, purpose EVENT_AVAILABILITY). Bez logowania. |

## 5. Rezerwacje

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| POST | `/api/bookings` | publiczny* | `{parkingId, eventId? \| (startsAt, endsAt), spots=1, vehiclePlate?, contact: {email, phone}, consents: {terms: true, privacy: true, marketingEmail?}}`. **`consents` jest wymagane** — konto zakładane „przy okazji" to nadal konto, więc obie zgody zbieramy na ekranie płatności i wersjonujemy (RODO). *Konto tworzone, jeśli email nieznany (bez hasła; mail aktywacyjny po zakupie). Serwer: cena → transakcja z `FOR UPDATE` (patrz DATA_MODEL §5) → 201 `{bookingId, priceGr, spots, startsAt, endsAt, pendingExpiresAt}` albo 409 `SLOT_TAKEN` / 422 `NOT_AVAILABLE_IN_WINDOW`. PENDING wygasa po 15 min. |
| GET | `/api/bookings/mine` | user | Aktywna rezerwacja **pierwsza** (zasada UX: to pierwsze, co user widzi). |
| GET | `/api/bookings/:id` | właściciel rez. | Po CONFIRMED zawiera `code`, QR (data URL), `accessInstructions`, `entranceLocation`, `entranceNotes`. |
| POST | `/api/bookings/:id/cancel` | właściciel rez. | Zwraca **przed wykonaniem** wyliczenie: `{refundGr, refundPct, policy}` przy `?preview=true`; POST bez preview wykonuje anulowanie + zwrot przez PSP. |

## 6. Płatności

Szczegóły flow: `docs/PAYMENTS.md`. Kontrakt niezależny od providera:

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| POST | `/api/payments/intent` | posiadacz PENDING booking | `{bookingId, method: 'BLIK'\|'CARD'}` → dane dla klienta PSP (`clientSecret` itp.). Kwota z `booking.price_gr`, nigdy z requestu. |
| POST | `/api/webhooks/{provider}` | podpis PSP | 1. weryfikacja podpisu (błędny → 400, bez treści), 2. `INSERT INTO webhook_events ON CONFLICT DO NOTHING` (duplikat → 200), 3. porównanie kwoty, 4. booking → CONFIRMED, generacja kodu, mail+SMS. Zawsze szybkie 200; cięższa robota (mail) po odpowiedzi. |
| POST | `/api/admin/refunds` | ADMIN | `{bookingId, amountGr?}` — zwrot pełny/częściowy poza polityką (interwencje). |

## 7. Skaner (host)

| Metoda | Ścieżka | Rola | Opis |
|---|---|---|---|
| POST | `/api/scan/validate` | host | Online: `{code | codeHash, parkingId}` → `{result: 'ADMITTED'\|'REJECTED_USED'\|'REJECTED_INVALID'\|'REJECTED_TIME', booking?: {spots, vehiclePlate}}`. Walidacja: kod istnieje → parking się zgadza → status CONFIRMED → okno czasowe (± bufor 1 h) → nieużyty. Sukces oznacza USED + wiersz `booking_scans`. |
| GET | `/api/scan/manifest?eventId=…` | host | Paczka offline **przed eventem**: `{generatedAt, entries: [{codeHash, startsAt, endsAt, spots, status}]}` dla parkingów hosta na ten event. Hashe, nie kody. |
| POST | `/api/scan/sync` | host | Batch skanów offline: `[{codeHash, scannedAt, result, deviceId}]` → serwer aplikuje, wykrywa konflikty (kod przyjęty na 2 urządzeniach → pierwszy wg `scannedAt` wygrywa, pozostałe `conflict=true`), zwraca rozstrzygnięcia. Idempotentny (klucz: `codeHash+deviceId+scannedAt`). |
| POST | `/api/scan/manual` | host | `{code, parkingId}` — ręczne wpisanie kodu, ta sama walidacja co `/validate`. |

## 8. Panel hosta — dane

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/host/bookings?date=today|upcoming` | Rezerwacje na parkingi hosta. |
| GET | `/api/host/earnings` | `{totalGr, pendingPayoutGr, payouts: [...]}` — zarobki, oczekujące, historia. |

## 9. Admin

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/admin/parkings?status=PENDING_REVIEW` | Kolejka moderacji. |
| POST | `/api/admin/parkings/:id/review` | `{decision: 'ACTIVE'\|'REJECTED', reason?}` — reason wymagany przy REJECTED (422). Mail do hosta. |
| CRUD | `/api/admin/venues`, `/api/admin/events` | Zarządzanie obiektami i eventami. |
| GET/PUT | `/api/admin/commission-rules` | `{scope, userId?/parkingId?, ratePct}` — nadpisania stawek. Zapis = **nowa wersja** (`valid_from`), nigdy UPDATE. |
| DELETE | `/api/admin/commission-rules/:id` | Usuwa nadpisanie (scope USER/PARKING) i przywraca stawkę globalną. **Bez tego nadpisanie stawki jest nieodwracalne** i na zawsze zasłania 50/30. Stawki globalnej nie da się usunąć → 422. |
| GET | `/api/admin/dashboard` | `{gmvGr, txCount, commissionGr, activeHosts, conversion}` per okres. |
| GET | `/api/admin/transactions` | Lista z filtrem + akcja zwrotu (→ §6). |
| GET | `/api/admin/payouts?status=PENDING` | Raport „kto ile dostaje w tym tygodniu". |
| POST | `/api/admin/payouts` | Generuje wypłaty za okres (idempotentne — unikat na `payout_items.booking_id`). **Bez tego `mark-paid` nie ma czego oznaczać.** |
| POST | `/api/admin/payouts/:id/mark-paid` | `{providerRef}` — opcja C (przelew ręczny). Druga próba → 422 `ALREADY_PAID`. |
| GET | `/api/admin/leads` | Leady ze strony głównej: filtr statusu, szukanie po imieniu/adresie/telefonie/mailu. |
| GET | `/api/admin/clients` | Klienci (konta z rolą hosta i `employer_id IS NULL`) + liczba parkingów i pracowników. `?q=&kind=BUSINESS|INDIVIDUAL&includeDeleted=`. |

**Klienci i pracownicy — tylko server actions** (`src/app/(admin)/admin/actions.ts`), bo każda z tych
operacji zwraca do ekranu hasło tymczasowe, którego nie chcemy w logu żadnego proxy:
`createClientAction`, `updateClientAction`, `deleteClientAction` (miękkie + anonimizacja),
`createEmployeeAction`, `deleteEmployeeAction`, `resetPasswordAction` (unieważnia wszystkie sesje).
Hasło pokazujemy **raz** — w bazie jest wyłącznie hash. Konto pracownicze dostaje rolę
`HOST_EMPLOYEE` i `users.employer_id`; nie może samo zostać hostem (`upgradeToHostIndividual` → 403).

## 10. RODO

| Metoda | Ścieżka | Opis |
|---|---|---|
| GET | `/api/me` | Profil zalogowanego użytkownika. |
| POST | `/api/me/data-export` | Generuje eksport JSON, link mailem (token 24 h). Eksport **nie jest składowany** — powstaje przy otwarciu linku. |
| DELETE | `/api/me` | Anonimizacja wg DATA_MODEL §10; 409 jeśli aktywna rezerwacja w przyszłości. |
| GET/PUT | `/api/me/consents` | Podgląd i wycofanie zgód marketingowych. |

> **UI istnieje: `/konto`** (zgody, eksport, usunięcie konta, aktywna rezerwacja na górze). Luka RODO z poprzedniej wersji tego dokumentu jest zamknięta.
>
> **Czego nadal nie ma: `PATCH /api/me`.** „Moje dane" na `/konto` są tylko do odczytu — nie istnieje endpoint ani `updateProfile()` w `src/modules/users/service.ts`. Telefon da się dziś ustawić **wyłącznie** przy zakupie (`contact.phone` w `POST /api/bookings` zapisuje go na koncie). Kierowca, który poda zły numer, nie ma jak go poprawić, a to na telefon idzie SMS z kodem wjazdu.

## 11. Cron (wewnętrzne)

Wszystkie: `POST`, nagłówek `Authorization: Bearer $CRON_SECRET`, porównanie w czasie stałym, 401 bez treści. Wołane przez cron systemowy/Coolify (**nie** Vercel Cron — ten wysyła GET).

| Ścieżka | Częstotliwość | Opis |
|---|---|---|
| `/api/cron/expire-bookings` | 1 min | PENDING po TTL → EXPIRED, zwalnia miejsca. |
| `/api/cron/reconcile-payments` | 10 min | Domyka płatności, których webhook nie dotarł. |
| `/api/cron/event-reminders` | dziennie | Eventy za 7 dni → mail do hostów w promieniu (`host-event-prompt`). Deduplikacja przez `notification_log`. |

Do dopisania (nie istnieją): czyszczenie `rate_limits` i wygasłych `action_tokens`; przypomnienie 2 h przed startem (`booking-reminder`).
