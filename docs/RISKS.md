# RISKS.md — ParkSpot

Co może pójść nie tak i jak to mitygujemy. Posortowane: najpierw to, co zabija produkt.

---

## 1. Ryzyka produktowo-biznesowe

### R1. Zimny start podaży (najgroźniejsze)
Mapa bez parkingów = martwy produkt; hostowie bez kupujących = brak motywacji. **Mitygacja:** start wyłącznie wokół dwóch venues (Enea Stadion, MTP), ręczna akwizycja pierwszych 10–20 hostów przed pierwszym eventem (nogami, nie mailingiem); mail „Twój parking stoi pusty 800 m od stadionu" jako główny kanał aktywacji; puste stany w UI zawsze konwertują na rejestrację hosta (DESIGN_PRINCIPLES §6.9).

### R2. Sprzedaż tego samego miejsca dwa razy
Najszybszy sposób na utratę zaufania i zwroty. **Mitygacja:** dostępność + INSERT rezerwacji w jednej transakcji z `SELECT … FOR UPDATE` na wierszu parkingu (DATA_MODEL §5); test e2e: dwa równoległe zakupy ostatniego miejsca → dokładnie jeden sukces; PENDING z TTL 15 min, żeby porzucone koszyki nie blokowały podaży.

### R3. Host stoi przy bramie z martwą aplikacją (sieć padła)
40 tys. ludzi = padnięta sieć komórkowa; 200 osób w kolejce. **Mitygacja:** manifest kodów (hashe) do IndexedDB **przed** eventem, walidacja lokalna, sync po odzyskaniu sieci (ARCHITECTURE §5.2); e2e w trybie samolotowym jako warunek ukończenia Fazy 4; przypomnienie push/mail hostowi dzień przed: „pobierz listę kodów teraz".

### R4. Kierowca kupił miejsce, na które nie wjedzie
SUV 2,1 m vs parking 1,9 m; kamper na Caravans Salon. **Mitygacja:** `max_vehicle_height_cm`/`length` w modelu, filtr **przed** sprzedażą (parking ukryty albo wyraźnie oznaczony), nie komunikat po fakcie (DESIGN_PRINCIPLES §6.4).

### R5. Nawigacja prowadzi na środek placu zamiast do wjazdu
**Mitygacja:** `entrance_location` jako osobny punkt; nawigacja i piesza odległość liczone do wjazdu; formularz hosta wymusza pytanie „czy wjazd jest tam, gdzie parking?".

### R6. Fałszywe/nieistniejące parkingi
Ktoś wystawia cudzy plac, kasa znika, kierowca stoi przed zamkniętą bramą. **Mitygacja:** każdy parking przez PENDING_REVIEW (moderacja admina); payout dopiero po ukończonym KYC Stripe (realna tożsamość hosta); dla firm weryfikacja konta wypłat z Białą Listą; zdjęcia wymagane do wysokiej pozycji (profile_completeness).

---

## 2. Ryzyka prawne i regulacyjne

### R7. Status instytucji płatniczej (KNF)
Przyjmowanie cudzych środków bez MIP/KIP: kara do 5 mln zł (szczegóły i źródła: PAYMENTS §1C). **Mitygacja:** licencjonowany PSP z modelem connect/split (rekomendacja: Stripe Connect) — środki hosta nigdy nie przechodzą przez nasze konto; opcja „jedno konto + ręczne wypłaty" odrzucona.

### R8. RODO
Dane kierowców (mail, telefon, tablice) i hostów. **Mitygacja:** zgody wersjonowane przy rejestracji, eksport danych, usunięcie konta jako anonimizacja (DATA_MODEL §10), zero PII w logach i `notification_log` bez treści wiadomości, polityka prywatności przed startem produkcyjnym. Retencja: dane rozliczeniowe trzymamy 5 lat (obowiązek podatkowy), reszta znika z kontem.

### R9. Odpowiedzialność za szkody na parkingu
Samochód uszkodzony/okradziony na parkingu hosta — kto odpowiada? **Mitygacja (MVP):** regulamin jasno stawia platformę jako pośrednika (umowa najmu miejsca jest między hostem a kierowcą); `is_guarded`/`has_cctv` to deklaracje hosta, tak opisane w UI. Do konsultacji prawnej przed startem — **to nie jest porada prawna, tylko flaga do zaadresowania.**

### R10. Hostowie a podatki
Osoby prywatne zarabiające przez platformę = obowiązki DAC7 (raportowanie sprzedawców platform cyfrowych) powyżej progów (30 transakcji / 2000 EUR rocznie). **Mitygacja:** model danych już zbiera to, co DAC7 wymaga (tożsamość, kwoty, liczba transakcji); raportowanie do wdrożenia zanim pierwszy host przekroczy próg; informacja dla hostów w FAQ.

---

## 3. Ryzyka techniczne

### R11. Webhooki płatności
Duplikaty, brak dostarczenia, spoofing. **Mitygacja:** podpis + idempotencja na unikalnym `(provider, event_id)` + cron reconciliation odpytujący PSP o wiszące PENDING (PAYMENTS §3).

### R12. API rządowe leżą (Biała Lista, GUS)
**Mitygacja:** GUS zawsze best-effort (timeout 3 s, nie blokuje); Biała Lista z fallbackiem „wpisz dane ręcznie" (weryfikacja konta odroczona — parking i tak przechodzi moderację); walidacja sumy kontrolnej NIP lokalnie ogranicza requesty.

### R13. Limity geokodera
Nominatim: 1 req/s, zakaz produkcyjnego wolumenu. **Mitygacja:** Nominatim tylko dev; prod za interfejsem `Geocoder` → Geoapify/LocationIQ; cache wyników po stronie serwera (adresy się nie zmieniają); geokodowanie przy zapisie parkingu, nie przy każdym wyświetleniu.

### R14. Wydajność mapy przy wzroście
**Mitygacja:** bounding-box + GiST od dnia 1, limit 500 pinów, lekkie payloady pinów, debounce 300 ms; EXPLAIN w testach jako regresja (Faza 1 „done").

### R15. Jeden VPS = pojedynczy punkt awarii
Awaria w dniu meczu = utrata sprzedaży szczytu. **Mitygacja (adekwatna do skali):** monitoring uptime z alertem; odtworzenie na świeżym VPS w około godzinę: `docker build` z jednego `Dockerfile` (obraz produkcyjny, EXPOSE 3000) + Postgres postawiony na VPS-ie i wskazany przez `DATABASE_URL`; skaner hosta działa offline nawet przy awarii backendu (manifest pobrany wcześniej). HA odkładamy świadomie — koszt nieuzasadniony przy MVP.

**Backup jest teraz krytyczny, nie pomocniczy.** Baza nie jest opisana żadnym plikiem w repo — to Postgres, który operator utrzymuje na VPS-ie. Odtwarza ją wyłącznie: nocny `pg_dump` z **testem odtworzenia** (Faza 5) + rozszerzenia z `db/extensions.sql` (postgis, citext, pgcrypto — bez PostGIS pierwsza migracja pada). Migracje i dane referencyjne (reguły prowizji, polityka zwrotów, venues, eventy) nakłada entrypoint kontenera przy starcie. Bez świeżego dumpa tracimy rezerwacje i parkingi — kod odtworzy się sam, dane nie.

### R16. Koszty SMS zjadają prowizję
0,08–0,12 zł/SMS przy prowizji ~6 zł. **Mitygacja:** SMS za feature flagą, tylko potwierdzenie + przypomnienie 2 h przed; mail zawsze; monitorowanie kosztu per transakcja w dashboardzie admina.

### R17. Bezpieczeństwo auth
Własny JWT = własne błędy. **Mitygacja:** Argon2id, refresh rotation z detekcją reuse (unieważnienie rodziny), access 15 min, httpOnly+Secure+SameSite, rate limit na auth, testy jednostkowe całego flow tokenów; secrets w `.env`.

### R18. Kod QR podrobiony / wyciek kodów
**Mitygacja:** kody wysokiej entropii (bez O/0/I/1), w manifestach offline wyłącznie hashe; skan znaczy kod jako USED transakcyjnie; konflikt dwóch urządzeń → pierwszy wygrywa, drugi flagowany (DATA_MODEL §5).

---

## 4. Ryzyka procesu

### R19. Scope creep
Największe ryzyko wewnętrzne. **Mitygacja:** twarda lista „NIE budujemy" w ROADMAP.md; stop po każdej fazie; każda propozycja spoza listy wymaga jawnej decyzji właściciela projektu.

### R20. Design „AI-slop" podważa zaufanie
Produkt, który wygląda jak weekendowy side-project, nie dostanie 35 zł przelewem. **Mitygacja:** DESIGN_PRINCIPLES.md z listą anty-slop jako twardy zakaz; proces: 12 makiet → feedback → tokeny → dopiero kod UI.
