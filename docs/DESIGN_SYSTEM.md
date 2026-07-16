# DESIGN_SYSTEM.md — Parkownia

Dokument wiążący dla zasad (anty-slop, UX, copy): **`docs/DESIGN_PRINCIPLES.md`**. Ten plik to *konkrety*: tokeny, typografia, komponenty. Jeśli wartość nie jest tokenem — jest błędem.

**Kierunek wizualny wybrany przez właściciela:**
- **Motyw jasny — „Bilet".** Rezerwacja *jest* biletem: chłodna, papierowa (nie kremowa) baza, stemplowa czerwień jako akcent, perforacja i monospace na kodach oraz kwotach.
- **Motyw ciemny — „Zmierzch".** To samo DNA, inna podłoga: ciepły grafit, a akcent zostaje **stemplową czerwienią** — ten sam odcień co w jasnym, tylko rozjaśniony pod near-black. Akcent marki nie zmienia się razem z motywem; zmienia się tylko jego jasność.

Oba motywy to **jeden zestaw tokenów** — komponenty nie wiedzą, w którym motywie działają.

---

## 1. Tokeny koloru

Definicja: `src/app/globals.css`. Mapowanie na klasy: `tailwind.config.ts`. Motyw przełącza jeden atrybut na `<html>` (`data-theme="light" | "dark"`, brak atrybutu = preferencja systemu).

> **Ciemna paleta jest w `globals.css` zapisana dwa razy** — raz dla jawnego przełącznika (`:root[data-theme="dark"]`), raz dla preferencji systemu (`@media (prefers-color-scheme: dark)`). CSS nie potrafi dzielić jednej reguły przez granicę media query, więc duplikat jest konieczny. **Zmieniasz token w jednej kopii → zmień w obu.** Pilnuje tego `tests/unit/design/theme-tokens.test.ts`; rozjazd wywala build. Kopia systemowa musi używać selektora `:root:not([data-theme])` — wariant `:not([data-theme="light"])` łapie się także na `data-theme="dark"`, remisuje na specyficzności i po cichu nadpisuje świadomy wybór użytkownika. Ten błąd już raz pojechał na produkcję.

| Token | Klasa Tailwind | Jasny (Bilet) | Ciemny (Zmierzch) | Rola |
|---|---|---|---|---|
| `--bg` | `bg-bg` | `#EEEEEB` | `#1A1918` | tło aplikacji, podkład mapy |
| `--surface` | `bg-surface` | `#FFFFFF` | `#232221` | karty, panele, bilet |
| `--surface-2` | `bg-surface-2` | `#F3F3F0` | `#2C2A28` | pola nieaktywne, hover, skeleton |
| `--ink` | `text-ink` | `#191A1C` | `#F1EDE7` | tekst główny |
| `--muted` | `text-muted` | `#70747A` | `#9E978D` | tekst pomocniczy, meta, hinty |
| `--line` | `border-line` | `#DEDEDA` | `#38352F` | obramowania, linia perforacji |
| `--accent` | `bg-accent` / `text-accent` | `#8E2B2B` | `#C93A3A` | **tylko** główne CTA, aktywna pinezka, potwierdzenie sukcesu |
| `--accent-ink` | `text-accent-ink` | `#FFFFFF` | `#FFF7F5` | tekst na akcencie (4.9:1 na `--accent`) |
| `--accent-hover` / `--accent-active` | — | `#7A2424` / `#661D1D` | `#D64B4B` / `#B23131` | stany akcentu |
| `--selected-bg` / `--selected-ink` | `bg-selected` / `text-selected-ink` | `#191A1C` / `#EEEEEB` | `#F1EDE7` / `#1A1918` | **stan zaznaczenia — neutralna inwersja, nigdy akcent** |
| `--focus` | `outline-focus` | `#191A1C` | `#F1EDE7` | pierścień focusu (afordancja systemowa, więc ink, nie akcent) |
| `--overlay` | `bg-overlay` | `rgb(25 26 28 / .45)` | `rgb(0 0 0 / .62)` | tło pod sheetem/dialogiem |

### Kolory bezpieczeństwa (nie są akcentem marki)

| Token | Klasa | Wartość | Gdzie wolno |
|---|---|---|---|
| `--scan-ok` | `text-scan-ok` / `bg-scan-ok` | `#0F7B4F` (oba motywy) | pełnoekranowy werdykt skanera „WPUŚĆ", status „Ważna" |
| `--scan-bad` | `bg-scan-bad` | `#B3261E` (oba motywy) | pełnoekranowy werdykt skanera „ODMÓW" |
| `--danger` | `text-danger` / `border-danger` | `#B3261E` / ciemny `#F2857D` | błędy formularzy, akcje destrukcyjne |
| `--danger-soft` | `bg-danger-soft` | `#FBEAE9` / `#34211F` | hover przycisku destrukcyjnego |

Ekran skanera jest jedynym miejscem, gdzie kolor wypełnia cały viewport — kontrast AAA, bo host stoi w słońcu. Werdykt zawsze niesie **ikonę + słowo**, nigdy sam kolor.

### Zasada akcentu (twarda)

Akcent wolno użyć w **trzech** miejscach:
1. Główne CTA na ekranie (jedno).
2. Aktywna pinezka na mapie.
3. Potwierdzenie sukcesu (toast `tone="ok"`, ekran po płatności).

Wszystko inne — filtry, zaznaczone opcje, przełączniki, paski postępu, aktywne zakładki — jest **neutralne** (`selected` = inwersja ink/bg). Przycisk destrukcyjny jest **konturowy**, nie wypełniony: w motywie jasnym czerwień stemplowa (akcent) i czerwień błędu to dwie głębokie czerwienie, a „Anuluj rezerwację" nie może wyglądać jak „Zarezerwuj".

---

## 2. Typografia

| Rola | Krój | Zmienna | Użycie |
|---|---|---|---|
| display | **Archivo** 700/800 | `--font-display`, `font-display` | nagłówki H1–H3, tytuły kart, nazwa parkingu |
| body | **IBM Plex Sans** 400/500/600 | `--font-body`, `font-body` | całe UI, opisy, etykiety, przyciski |
| mono | **IBM Plex Mono** 400/500/600 | `--font-mono`, `font-mono` | **wyłącznie** kody rezerwacji i kwoty |

Ładowane przez `next/font/google` w `src/app/layout.tsx` (self-hosting, brak FOUT, brak zewnętrznego requestu w runtime).

### Skala — sześć poziomów, ani jednego więcej

| Klasa | Rozmiar / interlinia | Rola |
|---|---|---|
| `text-ui` | 14 / 20 px | etykiety, meta, chipy, hinty — **podłoga UI** |
| `text-body` | 16 / 24 px | tekst czytany, inputy |
| `text-lead` | 18 / 26 px | cena w liście, akapit prowadzący |
| `text-h3` | 22 / 28 px | tytuł karty, nagłówek sheeta |
| `text-h2` | 28 / 34 px | kod rezerwacji, cena na bilecie |
| `text-h1` | 36 / 40 px | nagłówek ekranu |

`font-variant-numeric: tabular-nums` (klasa `.num`, automatycznie na `time`, `code`, `input[type=number]`) wszędzie, gdzie są ceny, czasy i kody — kolumna cen musi się wyrównywać.

Format kwoty: **`35 zł`** (`formatMoney` z `src/lib/format.ts`, wejście: grosze `integer`). Cyfra mono, waluta w body — `zł` w monospace wygląda jak literówka.

---

## 3. Kształt, elewacja, ruch

**Promienie:** chip `8px` · przycisk/input `12px` · karta `14px` · sheet `20px` · pill `999px`. **Zero ostrych rogów.**

**Elewacja:** dwa poziomy. `shadow-card` (karta na tle) i `shadow-float` (panel nad mapą, dialog, toast). Bilet używa `drop-shadow-ticket` — element z maską ucina `box-shadow`, więc cień musi iść filtrem.

**Ruch:** `--dur-micro` 180 ms (stany, hover, `:active` scale 0.97), `--dur-layout` 320 ms (sheet, dialog). Wejście `--ease-out`, wyjście `--ease-in`. Nic dłużej niż 400 ms. `prefers-reduced-motion: reduce` wyłącza ruch globalnie (`globals.css`) — sheet i dialog wykrywają to również w JS i zamykają się natychmiast, zamiast czekać na `animationend`.

---

## 4. Element sygnaturowy — pinezka z ceną jako oderwany odcinek biletu

Jedna rzecz, po której aplikacja ma być zapamiętana. **Cała śmiałość idzie tutaj, reszta jest cicha.**

```
   ┌───────────────┐
   │ 35 zł         │   ← cena: mono, tabular, text-lead
 ○─┤ 6 min · 🅟    │   ← czas pieszo (ok.) + ikona zadaszenia (SVG, nie emoji)
   └──────┬────────┘
          ▼            ← szpic celuje we WJAZD, nie w środek placu
```

- Szerokość ~60 px w stanie spoczynku, wysokość 44 px (cel dotykowy).
- Lewa krawędź ma **wycięcie perforacji** — ten sam ząb, co na bilecie. Pinezka to fizycznie „oderwany odcinek": zabranie jej z mapy da bilet.
- Stan aktywny (wybrana pinezka) — **jedyne** miejsce poza CTA i sukcesem, gdzie żyje akcent: tło `accent`, tekst `accent-ink`.
- Stan nieaktywny: `surface` + `ink` + `line`.
- Stan podniesiony (kursor na powiązanej karcie z listy, tylko desktop — `hover-hover:`): obramowanie `ink` i ślad skali. **Neutralny, nigdy akcent** — akcent zostaje zarezerwowany dla zaznaczenia, które zawsze go przebija. Na dotyku nie istnieje.
- Bez pulsowania, bez animowanego wejścia. Rusza się tylko mapa (`flyTo`), bo to komunikuje ciągłość przestrzenną.
- Pinezka wskazuje `entranceLocation` (wjazd), nie `location`. To nie jest kosmetyka — kierowca jedzie do wjazdu.

Implementacja pinezki należy do warstwy mapy (Faza 4 wg ROADMAP), nie do prymitywów.

---

## 5. Inwentarz komponentów (`src/components/ui/`)

| Komponent | Plik | Decyzja, która nie jest oczywista |
|---|---|---|
| `Button` | `button.tsx` | warianty `accent`/`quiet`/`ghost`/`danger`, rozmiary `sm`/`md`/`lg`; `min-h-touch` (44 px) na każdym; `loading` nie chowa etykiety (zero skoku layoutu); `danger` jest konturowy |
| `Input`, `Textarea`, `Select` | — | `Select` to natywny `<select>` (picker OS jest pod kciukiem i działa offline); `Input` z `suffix` na jednostki (`cm`, `zł`) |
| `Field` | `field.tsx` | label **zawsze** powiązany z inputem (render-prop podaje `id` + `aria-describedby` + `aria-invalid`); błąd ma `role="alert"`; pola opcjonalne są oznaczone, wymagane nie muszą się tłumaczyć |
| `Checkbox`, `RadioGroup`, `Switch` | — | natywne inputy pod spodem (klawiatura, formularze, czytniki ekranu); stan zaznaczony **neutralny**; `RadioGroup` to pełnowymiarowe wiersze, nie kropki 20 px |
| `Card` | `card.tsx` | `floating` dla kart nad mapą |
| `PageContainer` | `page-container.tsx` | rozdziela **powłokę** strony od **miary czytania**, które wcześniej były jedną liczbą (`max-w-3xl` na wszystkim = telefon w pustych marginesach na monitorze). Szerokość wybiera typ treści: `prose` \| `default` \| `wide` \| `full`. Poniżej `lg:` każdy wariant zwija się do tej samej kolumny mobilnej — telefon renderuje się bez zmian |
| `Ticket` | `ticket.tsx` | **perforacja jako maska CSS** (`.ticket-notch-top/bottom`), nie `border-dashed`; dziury są prawdziwe — mapa widać przez nie. Każda połowa niesie połowę dziury, więc łączą się w koło bez mierzenia czegokolwiek w JS |
| `Sheet` | `sheet.tsx` | bottom sheet ≤768 px, panel boczny wyżej; oparty na natywnym `<dialog showModal()>` (focus trap, Escape, top-layer z platformy); wychodzi tam, skąd wszedł |
| `Dialog` | `dialog.tsx` | akcja destrukcyjna nie sąsiaduje z potwierdzającą (`flex-col-reverse` na mobile) |
| `Badge` | `badge.tsx` | **`icon` jest wymagany typem** — status rezerwacji nie może być zakodowany samym kolorem (8% mężczyzn, a to grupa docelowa) |
| `Chip` | `chip.tsx` | filtr; `aria-pressed`; stan włączony neutralny |
| `Skeleton` | `skeleton.tsx` | zamiast spinnerów przy listach; rezerwuje layout |
| `Toast` | `toast.tsx` | błędy **nie znikają same** (błąd, który odjechał, to błąd dwa razy); sukces = akcent |
| `Price` | `price.tsx` | wejście: grosze `integer` prosto z bazy |
| `Progress` | `progress.tsx` | tylko determinowany — pasek bez wartości nie mówi nic |
| `EmptyState` | `empty-state.tsx` | pusty stan to zaproszenie do działania i szansa na podaż, nie „Brak wyników" |
| `ThemeToggle` | `../theme-toggle.tsx` | system / jasny / ciemny; zapis w `localStorage`; skrypt inline w `layout.tsx` zapobiega mignięciu motywu |

Wszystkie prymitywy: focus widoczny (`:focus-visible` → 2 px `--focus`, offset 2 px), cele dotykowe ≥ 44×44 px, brak koloru jako jedynego nośnika informacji.

---

## 6. Mapa

`src/styles/map-light.json` i `src/styles/map-dark.json` — style MapLibre, raster OSM z wymaganą atrybucją, odbarwiony (`raster-saturation` ujemna), w ciemnym dodatkowo przyciemniony, żeby mapa była **podłogą**, a nie konkurencją dla pinezek.

> **Dług do spłacenia przed produkcją.** Raster z `tile.openstreetmap.org` to rozwiązanie deweloperskie — polityka OSM zabrania ruchu produkcyjnego, a filtr na rastrze nie da się zestroić z paletą bez papkowania napisów. Produkcja: **kafelki wektorowe (MapTiler albo Protomaps)** ze stylem wyprowadzonym z tokenów obu motywów. Wpisane do `docs/RISKS.md` jako zależność Fazy 5.

---

## 7. Czego w tym systemie nie ma (świadomie)

Gradientów (CTA, tekst, ramka), glassmorphismu, emoji jako ikon, animacji przy scrollu, pulsujących CTA, animowanych liczników, trzeciego poziomu cienia, tekstury papieru pod motyw „Bilet" (ozdoba bez funkcji), paska kodu kreskowego na bilecie (kod QR już niesie tę informację — dekoracja udająca dane to kłamstwo wizualne).
