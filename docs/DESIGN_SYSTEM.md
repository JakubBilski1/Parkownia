# DESIGN_SYSTEM.md — ParkSpot

**Status: kierunek wizualny NIEWYBRANY. Ten dokument jest szkieletem — wypełni się po decyzji.**

Dokument wiążący dla wszystkich zasad (anty-slop, UX, typografia, animacja, copy): **`docs/DESIGN_PRINCIPLES.md`**. Ten plik będzie zawierał *konkrety* (tokeny, komponenty) wyprowadzone z wybranego kierunku.

## Proces decyzyjny (ustalony z właścicielem projektu)

1. **12 makiet** — statyczne HTML (Artifacts), jednorazowe, do wyrzucenia. Każda to inny, radykalnie odmienny kierunek wizualny ekranu głównego (mapa + karta parkingu, mobile 375 px). Nie 12 wariacji jednego pomysłu.
2. Właściciel projektu reaguje na makiety: co się podoba, co nie — możliwe mieszanie elementów z różnych kierunków.
3. Z feedbacku powstaje finalny kierunek → ten dokument dostaje: paletę (4–6 nazwanych tokenów hex), typografię (2–3 kroje z rolami: display / body / mono), skalę typograficzną (≤6 poziomów), tokeny animacji (czasy, easing), specyfikację elementu sygnaturowego, inwentarz komponentów.
4. Dopiero potem powstaje kod UI — każdy kolor i rozmiar z tokenów, zero wartości ad hoc.

## Co już jest przesądzone (niezależnie od kierunku)

- Wszystkie twarde reguły z DESIGN_PRINCIPLES.md, w szczególności: lista anty-slop (§1), cyfry tabelaryczne przy cenach/czasach/kodach, min. 14 px UI / 16 px body, cele dotykowe 44×44 px, akcent jeden i święty, WCAG AA (AAA na skanerze), `prefers-reduced-motion`, responsywność od 375 px.
- Baza komponentów: shadcn/ui **przestylowane tokenami** — domyślny look shadcn nie jest akceptowalnym stanem końcowym.
- Mapa: własny styl kafelków MapLibre spójny z wybraną paletą (styl JSON wersjonowany w repo).
