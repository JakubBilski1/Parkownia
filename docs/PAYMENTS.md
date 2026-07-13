# PAYMENTS.md — ParkSpot

Najtrudniejszy moduł systemu. To są **marketplace payments (split payments)**, nie zwykły checkout: platforma pobiera prowizję (50% INDIVIDUAL / 30% BUSINESS), resztę dostaje host. Research: lipiec 2026, źródła przy każdej liczbie.

**Status decyzji: REKOMENDACJA ZŁOŻONA (opcja A — Stripe Connect Express), czeka na akceptację właściciela projektu.**

---

## 1. Porównanie opcji

### Opcja A — Stripe Connect Express (rekomendowana)

Każdy host przechodzi hosted onboarding Stripe (KYC po stronie Stripe), Stripe wypłaca mu bezpośrednio; platforma ustawia `application_fee_amount` = prowizja.

- **BLIK: wspierany** (PLN, capability `blik_payments` na platformie i kontach connected). Ograniczenia BLIK: autoryzacja klienta w 60 s, brak manual capture, pełne i częściowe zwroty działają. ([docs.stripe.com/payments/blik](https://docs.stripe.com/payments/blik))
- **Opłaty transakcyjne PL:** BLIK **1,6% + 1,00 zł**; karty EEA **1,5% + 1,00 zł**; chargeback 90 zł; bez setup fee i abonamentu. ([stripe.com/en-pl/pricing](https://stripe.com/en-pl/pricing))
- **Opłaty Connect** (model „platform handles pricing"): **9 zł/mies. za aktywne konto Express** (aktywne = dostało payout w tym miesiącu) + **0,25% + 1,35 zł za payout**. Onboarding bez osobnej opłaty. ([stripe.com/en-pl/connect/pricing](https://stripe.com/en-pl/connect/pricing))
- **Osoby prywatne:** `business_type=individual` udokumentowany; KYC osoby fizycznej UE: dane osobowe, przy wątpliwościach skan dokumentu. ([docs.stripe.com/connect/required-verification-information](https://docs.stripe.com/connect/required-verification-information)) ⚠ Brak źródła mówiącego wprost „osoba bez DG w Polsce przejdzie" — **do weryfikacji testowym kontem przed startem Fazy 3.**
- **Model charge'ów: destination charges + `application_fee_amount`.** Platforma jest merchant-of-record (nasz deskryptor na wyciągu kierowcy, spójny UX), prowizja potrącana automatycznie, reszta ląduje na koncie connected hosta. Direct charges czynią hosta merchantem — bez sensu dla osób prywatnych.
- **Wdrożenie: dni.** Self-service, bez negocjowanej umowy, najlepsza dokumentacja w branży.

### Opcja B — polskie rozwiązania marketplace

| | P24 Marketplace | Autopay | PayU Marketplace | Tpay |
|---|---|---|---|---|
| Produkt istnieje | tak | tak (split, D+1) | tak, dojrzały | tak |
| BLIK koszt | ~1,2–1,4% (negocjowane) | 0,99–1,39% (negocjowane) | negocjowane, brak cennika | brak cennika |
| Osoby prywatne jako odbiorcy | **niepotwierdzone** (regulamin: nie-przedsiębiorca nie zawrze umowy przez rejestrację) | niepotwierdzone | **TAK — C2C boarding przez API potwierdzony w docs** | brak danych |
| Czas startu | tygodnie (umowa negocjowana) | tygodnie (oferta indyw.) | tygodnie (umowa + boarding API) | tygodnie |

Źródła: [developers.przelewy24.pl/marketplace](https://developers.przelewy24.pl/marketplace/), [developers.autopay.pl/online/marketplace](https://developers.autopay.pl/online/marketplace), [developers.payu.com/europe/docs/services/marketplace](https://developers.payu.com/europe/docs/services/marketplace/), [tpay.com/dla-biznesu/marketplace](https://tpay.com/dla-biznesu/marketplace).

Taniej na transakcji (~1 zł mniej na 30 zł), ale każda opcja = tygodnie negocjacji umowy i (poza PayU) niepotwierdzone wsparcie osób prywatnych. **PayU Marketplace to najsensowniejszy kandydat na renegocjację po walidacji rynku.**

### Opcja C — jedno konto + ręczne wypłaty (odrzucona)

Prawnie: operator wchodzący w posiadanie cudzych środków „choćby na chwilę" świadczy usługę płatniczą i wymaga statusu **MIP/KIP** (ustawa o usługach płatniczych). Wyłączenie agenta handlowego (art. 6 pkt 2 UUP / art. 3(b) PSD2) po PSD2 działa tylko przy reprezentowaniu **jednej** strony transakcji — marketplace działa w imieniu obu, więc wyłączenie nie obejmuje ParkSpot (interpretacja rynkowa + motyw 11 PSD2; PSR ma je dalej zawęzić). Wpis MIP: 616 zł opłaty, ustawowo 3 mies., realnie 3–6 mies., obowiązki sprawozdawcze KNF/NBP. Działalność bez statusu: **kara do 5 mln zł, do 2 lat pozbawienia wolności, lista ostrzeżeń KNF.** Przy skali MVP prawdopodobieństwo egzekucji niskie, ale sankcje zaporowe, a procedura MIP zabija timeline. Źródła: [legalgeek.pl/blog/mip-czy-go-potrzebujesz-marketplace](https://legalgeek.pl/blog/mip-czy-go-potrzebujesz-marketplace/), [knf.gov.pl — MIP](https://www.knf.gov.pl/dla_rynku/procesy_licencyjne/platniczy/MIP/Informacje_Ogolne).

### Koszt na transakcji 30 zł BLIK (Stripe)

```
kierowca płaci:            30,00 zł
Stripe (1,6% + 1 zł):      −1,48 zł
prowizja platformy (50%):  15,00 zł  → my (z tego pokrywamy koszt Stripe)
host (INDIVIDUAL):         15,00 zł  → payout (koszt payoutu: 0,25% + 1,35 zł
                                        amortyzowany przy wypłatach zbiorczych)
```
Przy 30 aktywnych hostach: +270 zł/mies. opłat za konta. Przewaga kosztowa polskich PSP ≈ 200–400 zł/mies. przy setkach transakcji — mniej niż koszt tygodni opóźnienia startu.

### Rekomendacja

**Stripe Connect Express, destination charges + application_fee_amount.** Jedyna opcja z potwierdzonym BLIK + udokumentowanym onboardingiem osób prywatnych + startem w dni bez negocjacji. Warstwa płatności za interfejsem `PaymentProvider` od pierwszej linii kodu; po walidacji rynku zbieramy oferty PayU/P24 Marketplace i decydujemy o migracji z danymi w ręku.

**Przed ostateczną akceptacją:** (1) test onboardingu Express dla osoby fizycznej bez DG w PL (konto testowe → tryb live z jednym hostem), (2) zapytania ofertowe do PayU i P24 z pytaniem wprost o osoby prywatne i czas umowy — dla porównania w przyszłości.

---

## 2. Pełny flow płatności (Stripe, destination charge)

### 2.1. Zakup

```
1. POST /api/bookings
   – cena liczona NA SERWERZE: cennik parkingu / cena eventowa
   – transakcja: FOR UPDATE na parkingu → check dostępności → INSERT
     booking PENDING (pending_expires_at = now()+15 min)
   – wyliczenie i ZAMROŻENIE w bookingu: commission_rate_pct (z commission_rules),
     commission_gr, host_payout_gr

2. POST /api/payments/intent  {bookingId, method}
   – booking PENDING istnieje i nie wygasł? (410 jeśli wygasł)
   – host ma ukończony onboarding Stripe? (charges_enabled) — jeśli nie,
     parking NIE JEST rezerwowalny (egzekwowane już przy publikacji)
   – PaymentIntent:
       amount: booking.price_gr          // NIGDY z requestu
       currency: 'pln'
       payment_method_types: ['blik','card']   // wg wyboru
       transfer_data[destination]: host.stripe_account_id
       application_fee_amount: booking.commission_gr
       metadata: { bookingId }
   – INSERT payments (INITIATED, provider_ref = pi_…)
   – → clientSecret do frontu

3. Front: Payment Element → kierowca wpisuje kod BLIK (60 s na autoryzację
   w aplikacji banku) / dane karty (3DS)

4. Webhook (patrz §3) potwierdza → booking CONFIRMED → kod + QR → mail/SMS
   → dopiero teraz kierowca widzi accessInstructions
```

### 2.2. Onboarding hosta

```
– upgrade do hosta → tworzenie konta connected (type: express,
  business_type: individual|company, country: PL)
– Account Link (refresh_url, return_url) → hosted KYC Stripe
– webhook account.updated → zapis charges_enabled / payouts_enabled
– parking można OPUBLIKOWAĆ dopiero, gdy payouts_enabled = true
  (inaczej sprzedalibyśmy miejsce, za które nie umiemy zapłacić hostowi)
– payouty: automatyczne, harmonogram tygodniowy (amortyzacja opłaty 0,25%+1,35 zł)
```

### 2.3. Zwroty (polityka anulowania)

Polityka domyślna (tabela `refund_policies`, konfigurowalna, wersjonowana — booking rozliczany wg polityki z chwili zakupu):

| Anulowanie przed startem rezerwacji | Zwrot |
|---|---|
| > 24 h | 100% |
| 2–24 h | 50% |
| < 2 h | 0% |

```
POST /api/bookings/:id/cancel?preview=true → {refundGr, refundPct, policy}
   (użytkownik widzi konsekwencje ZANIM kliknie — twarda zasada UX)
POST /api/bookings/:id/cancel
   – refund na PaymentIntent (kwota wg polityki)
   – reverse_transfer: true, refund_application_fee: proporcjonalnie
     (host i platforma oddają swoje części proporcjonalnie)
   – booking → CANCELLED, payments → (PARTIALLY_)REFUNDED po webhooku
   – jeśli booking był w payout_items niewypłaconych → korekta pozycji;
     jeśli już wypłacony → saldo ujemne hosta potrącane z kolejnych payoutów
```

---

## 3. Webhooki — podpis, idempotencja, błędy

### 3.1. Zasady

1. **Weryfikacja podpisu zawsze pierwsza** (`stripe.webhooks.constructEvent`, sekret z `.env`). Zły podpis → 400, bez logowania payloadu.
2. **Idempotencja na poziomie bazy:** `INSERT INTO webhook_events (provider, event_id) ON CONFLICT DO NOTHING` — konflikt = zdarzenie już przetworzone → **200 natychmiast**, zero skutków ubocznych. Ten sam webhook PRZYJDZIE kilka razy — to pewnik, nie edge case.
3. **Weryfikacja kwoty:** `event.amount === booking.price_gr`, inaczej alarm + brak potwierdzenia (nigdy nie ufamy niczemu spoza naszej bazy).
4. **Szybkie 200:** potwierdzenie bookingu w transakcji, mail/SMS po odpowiedzi (kolejka w procesie); Stripe retry'uje przy braku 200 przez 3 dni — nie blokować odpowiedzi wysyłką maila.
5. Obsługiwane zdarzenia: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `account.updated`. Nieznane typy → 200 (ignoruj, nie 500).

### 3.2. Scenariusze błędów

| Scenariusz | Zachowanie |
|---|---|
| Kierowca nie autoryzował BLIK w 60 s | `payment_failed` → payments FAILED; booking zostaje PENDING do TTL — kierowca może ponowić płatność (nowy intent, ta sama rezerwacja) |
| PENDING wygasł przed webhookiem `succeeded` (płatność w ostatniej sekundzie) | Webhook sprawdza `pending_expires_at`: jeśli miejsce nadal wolne (re-check transakcyjny) → CONFIRMED mimo spóźnienia; jeśli zajęte → automatyczny pełny refund + mail z przeprosinami. Nigdy nie zostawiamy pobranych pieniędzy bez rezerwacji. |
| Webhook nie dochodzi (awaria sieci) | Stripe retry 3 dni; dodatkowo cron co 10 min odpytuje PaymentIntents dla PENDING starszych niż 5 min (reconciliation) |
| Podwójny webhook | `webhook_events` ON CONFLICT → 200, no-op |
| Chargeback | `dispute.created` → booking flagowany, host powiadomiony, obsługa ręczna w adminie (MVP) |
| Awaria Stripe przy tworzeniu intentu | 503 do frontu z komunikatem wg zasad copy: co się stało, że środki NIE zostały pobrane, co robić |

### 3.3. Komunikaty błędów płatności (UI)

Wzorzec obowiązkowy (DESIGN_PRINCIPLES §6.10): **co się stało → czy kosztowało pieniądze → co dalej.**
> „Płatność nie przeszła. Środki nie zostały pobrane. Spróbuj ponownie albo użyj innej metody."

---

## 4. Wypłaty i rozliczenia

- W opcji A payouty realizuje Stripe (automatyczne, tygodniowe). Tabele `payouts`/`payout_items` **istnieją mimo to** — jako lustro rozliczeń do raportowania (admin: „kto ile dostał"), zasilane webhookami `payout.paid` z kont connected (Connect events).
- Prowizja: `commission_rules` (GLOBAL 50/30, nadpisania per user/parking przez admina), stawka **kopiowana do bookingu** w momencie rezerwacji — zmiany reguł nie dotykają historii.
- Faktury/rachunki dla hostów za prowizję: poza MVP, ale `payout_items` daje dane do ich wystawienia.

## 5. Bezpieczeństwo — podsumowanie twardych zasad

- Kwota **zawsze** z `booking.price_gr`, liczona na serwerze; `amount` z frontu nie istnieje w kontrakcie API.
- Sekrety Stripe (klucz, webhook secret) w `.env`; klucz publishable jedyny po stronie klienta.
- Zero payloadów płatności i PII w logach (w `webhook_events` tylko hash payloadu).
- Rate limit na `/api/payments/*` (10/min/user) i webhookach (po IP Stripe — allowlist).
- `accessInstructions` ujawniane wyłącznie po CONFIRMED.
