# Testy — ParkSpot

Trzy pakiety, trzy różne pytania. Nie zastępują się nawzajem.

| Pakiet | Komenda | Czego potrzebuje | Co sprawdza |
|---|---|---|---|
| `tests/unit` | `npm test` | nic | czysta logika: cena, prowizja, polityka zwrotów, harmonogram, NIP, kody |
| `tests/integration` | `npm run test:integration` | **PostgreSQL + PostGIS** | to, czego mock nie potrafi udowodnić: blokady wierszy, `ON CONFLICT`, `now()`, plany zapytań |
| `tests/e2e` | `npm run test:e2e` | serwer + baza | ścieżki krytyczne w przeglądarce (Playwright) |

`npm test` **musi** działać na świeżym klonie, bez bazy i bez Dockera. Dlatego pakiety
są rozdzielone przez `--project` w `package.json`, a nie przez „uruchom testy
integracyjne, jeśli akurat jest baza" — bo to znaczy, że w CI nie uruchomią się nigdy.

---

## Testy integracyjne

### Po co osobna baza

Testy piszą i kasują wiersze, a jeden z nich wstawia 500 parkingów, żeby planer
Postgresa naprawdę wybrał indeks GiST. Nie robi się tego na bazie deweloperskiej.

`TEST_DATABASE_URL` musi wskazywać **inną bazę** niż `DATABASE_URL` — inaczej
`tests/integration/global-setup.ts` odmawia startu.

```bash
# .env.local
DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot"
TEST_DATABASE_URL="postgresql://parkspot:parkspot@localhost:5433/parkspot_test"
```

Baza `parkspot_test` **tworzy się sama** przy pierwszym uruchomieniu: `global-setup`
zakłada ją, włącza rozszerzenia (`postgis`, `citext`, `pgcrypto`), puszcza migracje
i wstawia reguły prowizji oraz domyślną politykę zwrotów — bez nich `createBooking()`
słusznie odmawia przyjęcia pieniędzy. Wymaga roli z prawem `CREATEDB`.

```bash
npm run test:integration
```

### Sprzątanie i dane z seeda

Każdy wiersz stworzony przez testy jest **oznaczony**:

- użytkownicy: `…@test.parkspot.local`
- parkingi i eventy: tytuł zaczyna się od `[itest]`
- webhooki: `event_id` zaczyna się od `itest_`

`cleanupTestData()` kasuje dokładnie to i nic więcej — przed pierwszym testem (żeby
resztki po przerwanym przebiegu nie liczyły się jako zajętość), po każdym teście i na
końcu pliku. Dane z seeda (konta `@parkspot.pl`, 20 parkingów, 17 eventów) są dla tych
zapytań niewidzialne. Świadomie **nie** ma tu `TRUNCATE`.

### Co dokładnie jest testowane

| Plik | Pytanie |
|---|---|
| `double-booking.test.ts` | Czy dwóch kierowców może kupić to samo miejsce? |
| `webhook-idempotency.test.ts` | Czy ten sam webhook, przysłany drugi raz, coś zmienia? |
| `pending-expiry.test.ts` | Czy PENDING blokuje miejsce, dopóki żyje — i zwalnia je, gdy umrze? |
| `late-webhook.test.ts` | Pieniądze przyszły po wygaśnięciu rezerwacji. Kto ma miejsce, kto ma zwrot? |
| `geo-index.test.ts` | Czy zapytania mapy idą po indeksie GiST, czy po całej tabeli? |
| `data-leak.test.ts` | Czy kod do szlabanu i IBAN hosta wyciekają do nieopłaconej rezerwacji? |

**`double-booking.test.ts` jest najważniejszym testem w tym repozytorium.** Dwie
naprawdę równoległe transakcje (`Promise.all`, osobne połączenia z puli) walczą o
jedno miejsce — 10 rund, bo wyścig jest niedeterministyczny i jeden zielony przebieg
niczego nie dowodzi. Mock bazy nie ma menedżera blokad, więc zamockowana wersja tego
testu przechodziłaby niezależnie od tego, co robi kod.

### Co jest podmienione, a co nie

Podmienione jest **wyłącznie `next/headers`** (`tests/integration/request-scope.ts`):
route handlery wołane spoza serwera Next nie mają kontekstu żądania i `cookies()`
rzuca wyjątkiem. Kontekst jest odtworzony przez `AsyncLocalStorage` — tak jak robi to
Next — dzięki czemu dziesięć równoległych handlerów widzi dziesięć osobnych ciasteczek.

Wszystko inne jest prawdziwe: handler, schemat Zod, rate limiter, sesja, serwisy,
transakcje i baza. Statusy `201` i `409`, które zwracają te testy, to statusy, które
dostanie telefon kierowcy.

Provider płatności to `mock` (`PAYMENT_PROVIDER=mock`) — ale mock jedzie **tą samą**
drogą co Stripe: `/api/webhooks/mock` → weryfikacja → `webhook_events` →
`applySucceededPayment()` → `confirmPaidBooking()`. Kwota bierze się z intentu, który
utworzył nasz serwer, nigdy z ciała webhooka.

### Poczta

`setEmailProvider()` (test seam w `src/modules/notifications/email.ts`) podstawia
provider, który zlicza wysyłki. Maile lecą przez `fireAndForget` — nie są awaitowane,
bo webhook musi odpowiedzieć 200 zanim wyśle mail (`docs/PAYMENTS.md` §3.1.4). Dlatego
testy używają `waitFor()` (poll), a nie `sleep(500)`, i `settle()` tylko wtedy, gdy
mają udowodnić, że coś **nie** zostało wysłane.

---

## Testy e2e (Playwright)

```bash
npx playwright install chromium   # raz
npm run test:e2e
```

Serwer podnosi się sam (`webServer` w `playwright.config.ts`) na porcie **3200** —
nie 3000, żeby przebieg testów nie podłączył się przypadkiem pod dev-serwer, który
akurat masz otwarty, i nie testował tego, co tamten proces zdążył skompilować.
Baza musi żyć i być zaseedowana (`npm run db:migrate && npm run db:seed`).

### Dlaczego `next dev`, a nie `next build && next start`

Bo inaczej **nie da się kupić miejsca**. `MockPaymentProvider.verifyWebhook()`
(`src/modules/payments/mock.ts`) odmawia przyjęcia webhooka, gdy
`NODE_ENV=production` — i słusznie: żywy mockowy endpoint płatności na produkcji
znaczyłby, że każdy może POST-em wystawić sobie opłaconą rezerwację. To jest
zabezpieczenie, nie usterka. Konsekwencja: pod produkcyjnym buildem ścieżka
zakupowa jest martwa z definicji, więc suite jedzie na `next dev`.

Cena: pierwsze wejście na każdą trasę kompiluje ją (~5–20 s). Stąd długie timeouty
w configu. Konsekwencja druga: **Service Worker (`public/sw.js`) nie rejestruje się**
w dev (`PwaRegister` robi to tylko na produkcji), więc *powłoka* skanera offline nie
jest tu pokryta. Pokryty jest *werdykt* offline — czyli ta część, o którą chodzi.

### Co jest pokryte

| Plik | Ścieżka | Pytanie |
|---|---|---|
| `01-purchase.spec.ts` | krytyczna 1 | Czy kierowca dojdzie od mapy do kodu QR — i czy `access_instructions` NIE widać przed zapłatą? |
| `02-scan.spec.ts` | krytyczna 2 | Czy kod daje pełnoekranowy zielony „WPUŚĆ", a ten sam kod drugi raz — czerwony? |
| `03-quick-declare.spec.ts` | krytyczna 3 | Czy host udostępnia parking jednym kliknięciem z maila, bez logowania? |
| `04-parking-lifecycle.spec.ts` | podaż | Czy szkic parkingu przeżywa odświeżenie strony, a admin potrafi go zatwierdzić? |
| `05-scan-offline.spec.ts` | brama bez sieci | Czy skaner działa z IndexedDB przy wyłączonej sieci i dosyła skany po powrocie? |

`05-scan-offline.spec.ts` jest tu tym, czym `double-booking.test.ts` w integracyjnych:
bez niego cały moduł offline jest deklaracją w dokumencie. Test naprawdę gasi sieć
(`context.setOffline(true)`), sprawdza, że **żaden** request nie poszedł do
`/api/scan/*`, a werdykt i tak był zielony — a potem, że po `setOffline(false)`
rezerwacja doszła na serwer jako `USED` z `offline = true`.

### Dane i sprzątanie

Ta sama zasada co w integracyjnych: **nic się nie truncate'uje**. Wszystko, co suite
tworzy, jest oznaczone i tylko to jest kasowane (`cleanupE2eArtifacts()`):

- użytkownicy: `e2e-…@parkspot.test`
- eventy i parkingi: tytuł zaczyna się od `E2E`

Seed (20 parkingów, 17 eventów, 4 konta) przeżywa przebieg bez zadrapania.

Dwie rzeczy fikstury tworzą same, bo **nie da się ich zrobić z UI**: event, który
trwa *teraz* (seed ma najbliższy mecz za 11 dni, a brama wpuszcza kod tylko w oknie
±1 h — skan seedowej rezerwacji byłby poprawnym `REJECTED_TIME` i nie dowodziłby
niczego) oraz `action_token`, który normalnie przyjeżdża mailem. Wszystko inne idzie
przez prawdziwe kontrakty: rezerwacja powstaje przez `POST /api/bookings` →
`/api/payments/intent` → `/api/webhooks/mock`, a nie przez `INSERT`.

Weryfikacja jest zawsze w bazie, nie na ekranie. „Ekran napisał *Udostępnione*" nie
jest dowodem, że deklaracja się zapisała — wiersz w `event_parking_availability` jest.

### `workers: 1`, świadomie

Wszystkie specki jadą na jednej bazie i sprzedają miejsca na tych samych parkingach.
Równoległe workery kupowałyby sobie nawzajem ostatnie miejsce i kłóciły się o to, kto
zepsuł asercję. Zrównoleglać można dopiero po rozdzieleniu baz per worker.

### Limity zapytań

`loginAs()` i `purchaseBooking()` czyszczą tabelę `rate_limits` przed użyciem.
`POST /api/auth/*` ma limit 5/min na IP — suite loguje się częściej i szósty test
dostawałby 429, który nie mówi nic o produkcie. To odpowiednik odczekania minuty.

---

## Uruchamianie bazy

Nie ma compose'a — bazę przynosisz swoją: Postgres 14+ (u nas 16) z PostGIS, w WSL,
lokalnie, we własnym kontenerze albo zarządzany. Instalacja krok po kroku:
`db/README.md`.

Rola z `TEST_DATABASE_URL` musi mieć `CREATEDB` i prawo tworzenia rozszerzeń —
bazę `parkspot_test`, rozszerzenia i migracje `global-setup` zakłada sam.
