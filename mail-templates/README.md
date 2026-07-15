# Parkownia — szablony maili dla pbdevs

Apka nie renderuje już maili. Wysyła `POST https://mail.pbdevs.com/api/v1/send`
z `{ template: "<nazwa>", to, data }`, a pbdevs renderuje szablon (MJML + Handlebars)
po swojej stronie i trzyma temat oraz nadawcę. Te pliki `.mjml` to źródła do wklejenia
w panelu pbdevs. Skeleton, tokeny i klocki budujące opisuje `_layout.md`.

## Co trzeba zrobić w panelu pbdevs (aplikacja: Parkownia)

Dla **każdego** z 10 szablonów poniżej:

1. Utwórz szablon o **dokładnie tej nazwie** (apka odwołuje się po nazwie — literówka = 404 i mail nie idzie).
2. Wklej zawartość pliku `<nazwa>.mjml`.
3. Ustaw **temat** z tabeli (to też Handlebars — `{{...}}` działa w temacie).

Zmienne (`data`) apka buduje w `src/modules/notifications/templates.ts` — są już
gotowe do wyświetlenia: daty to `25.07.2026, 20:00` (Europe/Warsaw), kwoty to `35 zł`.
W szablonie **nie formatuj ich ponownie**.

| plik / nazwa szablonu | temat | zmienne `data` |
|---|---|---|
| `booking-confirmed` | `Twoja rezerwacja: {{code}}` | firstName, code, parkingTitle, address, startsAt, endsAt, spots, price, eventTitle, entranceNotes, accessInstructions, qrUrl, bookingUrl, ctaUrl, ctaLabel |
| `booking-reminder` | `Za 2 godziny: {{parkingTitle}}` | firstName, code, parkingTitle, address, startsAt, entranceNotes, accessInstructions, bookingUrl, ctaUrl, ctaLabel |
| `booking-cancelled` | `Rezerwacja {{code}} anulowana` | firstName, code, parkingTitle, startsAt, price, refund, whatHappened, reason, refundNote, byHost, mapUrl |
| `payment-failed` | `Płatność nie przeszła` | firstName, parkingTitle, price, charged, holdUntil, retryUrl, mapUrl |
| `host-event-prompt` | `{{eventTitle}} — {{eventDate}}. Udostępnisz miejsca?` | firstName, eventTitle, eventDate, eventDay, eventTime, venueName, parkingTitle, walkDistance, suggestion, payout, shareUrl, declineUrl |
| `host-payout` | `Wypłata {{amount}}` | firstName, amount, bookings, periodStart, periodEnd, accountLast4, earningsUrl |
| `parking-approved` | `{{parkingTitle}} jest na mapie` | firstName, parkingTitle, hasEvent, eventLine, availabilityUrl |
| `parking-rejected` | `Parking nie przeszedł weryfikacji: {{parkingTitle}}` | firstName, parkingTitle, reason, fixUrl |
| `password-reset` | `Ustaw nowe hasło` | firstName, expiresInMinutes, resetUrl |
| `data-export` | `Twoje dane są gotowe` | firstName, expiresAt, downloadUrl |

## Kod QR (`booking-confirmed`)

pbdevs nie obsługuje załączników, więc apka generuje PNG z kodem QR, wrzuca go na
S3 (`s3.putObject`) i podaje `qrUrl` w `data`; szablon osadza go przez
`<mj-image src="{{qrUrl}}">`. Gdy storage jest niedostępny, `qrUrl` przychodzi puste
— szablon chowa obrazek (`{{#if qrUrl}}`), a kierowca dostaje kod tekstem i z SMS-a.
**Wymaga to skonfigurowanego S3** (`S3_*` w env) na produkcji.

## Stopka i domena

Każdy szablon ma w stopce link `https://parkownia.com/konto` (Ustawienia powiadomień)
wpisany na sztywno. Linki w treści (przyciski) przychodzą jako pełne URL-e w `data`
i są budowane z `NEXT_PUBLIC_APP_URL`. Jeśli produkcyjna domena jest inna niż
`parkownia.com`, podmień ten jeden link w stopce każdego szablonu.

## Włączenie na produkcji (Coolify)

```
EMAIL_PROVIDER=pbdevs
MAIL_API_KEY=mc_...            # klucz per-aplikacja z panelu pbdevs
# MAIL_API_URL — opcjonalnie, domyślnie https://mail.pbdevs.com/api/v1/send
```

Bez `EMAIL_PROVIDER=pbdevs` apka zostaje na providerze `console` (maile lecą do
logów, nic nie wychodzi) — to jest domyślne i bezpieczne dla dev/lokalnie.

## Dane testowe do podglądu w panelu pbdevs

`booking-confirmed`:
```json
{ "firstName": "Marek", "code": "PK-7H2K-4XQ9", "parkingTitle": "Plac przy Bułgarskiej",
  "address": "ul. Bułgarska 17, Poznań", "startsAt": "25.07.2026, 19:00",
  "endsAt": "26.07.2026, 00:30", "spots": "1 miejsce", "price": "35 zł",
  "eventTitle": "Lech Poznań – Cracovia", "entranceNotes": "Wjazd od ul. Górczyńskiej, brama nr 2",
  "accessInstructions": "Szlaban na kod 4417.", "qrUrl": "https://placehold.co/160x160/191A1C/FFFFFF/png?text=QR",
  "bookingUrl": "https://parkownia.com/rezerwacja/abc", "ctaUrl": "https://parkownia.com/rezerwacja/abc",
  "ctaLabel": "Nawiguj do wjazdu" }
```

`host-event-prompt`:
```json
{ "firstName": "Anna", "eventTitle": "Lech Poznań – Cracovia", "eventDate": "sob., 25 lipca",
  "eventDay": "sobotę, 25 lipca", "eventTime": "19:00", "venueName": "Enea Stadion",
  "parkingTitle": "Podwórze przy Bułgarskiej 40", "walkDistance": "ok. 600 m pieszo",
  "suggestion": "10 miejsc po 30 zł", "payout": "150 zł",
  "shareUrl": "https://parkownia.com/udostepnij/tok", "declineUrl": "https://parkownia.com/udostepnij/tok?odpowiedz=nie" }
```

`payment-failed` (sprawdź oba warianty przełączając `charged`):
```json
{ "firstName": "Marek", "parkingTitle": "Plac przy Bułgarskiej", "price": "35 zł",
  "charged": false, "holdUntil": "25.07.2026, 12:15",
  "retryUrl": "https://parkownia.com/rezerwacja/abc/platnosc", "mapUrl": "https://parkownia.com/mapa" }
```
