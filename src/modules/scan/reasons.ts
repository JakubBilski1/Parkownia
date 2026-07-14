import type { ScanReason, ScanResult } from "./types";

/**
 * Gate copy. Polish, imperative, readable from arm's length in sunlight.
 * The verdict word is never the only signal — the screen also carries an icon
 * and a colour, and none of the three works alone.
 */
export const VERDICT_HEADLINE: Record<ScanResult, string> = {
  ADMITTED: "WPUŚĆ",
  REJECTED_USED: "NIE WPUSZCZAJ",
  REJECTED_INVALID: "NIE WPUSZCZAJ",
  REJECTED_TIME: "NIE WPUSZCZAJ",
};

/** One line, big type. What happened. */
export const REASON_HEADLINE: Record<ScanReason, string> = {
  OK: "Kod ważny",
  CODE_UNKNOWN: "Kod nieznany",
  WRONG_PARKING: "Kod na inny parking",
  NOT_PAID: "Rezerwacja nieopłacona",
  CANCELLED: "Rezerwacja anulowana",
  EXPIRED: "Rezerwacja wygasła",
  ALREADY_USED: "Kod już użyty",
  TOO_EARLY: "Za wcześnie",
  TOO_LATE: "Po czasie",
};

/** Second line, smaller. What the host does with the car standing in front of him. */
export const REASON_DETAIL: Record<ScanReason, string> = {
  OK: "Wskaż miejsce i zamknij bramę za autem.",
  CODE_UNKNOWN: "Ten kod nie należy do żadnej rezerwacji na tym evencie. Sprawdź, czy skanujesz właściwy kod, albo wpisz go ręcznie.",
  WRONG_PARKING: "Rezerwacja jest na inny parking. Nie wpuszczaj — kieruj kierowcę pod właściwy adres z jego potwierdzenia.",
  NOT_PAID: "Kierowca nie zapłacił, miejsce nie jest jego. Nie wpuszczaj.",
  CANCELLED: "Kierowca anulował tę rezerwację i dostał zwrot. Miejsce nie jest opłacone — nie wpuszczaj.",
  EXPIRED: "Rezerwacja wygasła przed opłaceniem. Miejsce nie jest opłacone — nie wpuszczaj.",
  ALREADY_USED: "Ten kod wjechał już wcześniej. Jeśli to ten sam samochód wraca, zdecyduj sam — system nie wpuści go drugi raz automatycznie.",
  TOO_EARLY: "Rezerwacja zaczyna się później. Wpuszczasz najwcześniej godzinę przed jej początkiem.",
  TOO_LATE: "Rezerwacja już się skończyła. Wjazd był możliwy do godziny po jej końcu.",
};
