# Eksport do playingcards.io

[playingcards.io](https://playingcards.io) pozwala grać w karty przez przeglądarkę. Generator nie buduje pokoju od zera. Bierze pokój, który już masz (stół, miejsca graczy, żetony, przyciski), i podmienia w nim talie na karty z generatora.

## 1. Pobierz pokój z playingcards.io

1. Otwórz swój pokój i wejdź w tryb edycji (**Edit Table**).
2. Wybierz **Export room** i zapisz plik `.pcio`, np. jako `stol.pcio`, w folderze projektu.

Plik `.pcio` to archiwum ZIP. W środku jest `widgets.json` (opis wszystkich elementów stołu) i folder `userassets/` z obrazkami.

## 2. Wskaż pokój i talie w szablonie

W części wspólnej szablonu:

```
STÓŁ = stol.pcio
```

W każdej talii, która ma trafić na stół:

```
PCIO = 3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f
```

`PCIO` to identyfikator talii (`cardDeck`) w pokoju. Żeby go znaleźć:

1. Rozpakuj kopię `stol.pcio` (zmień rozszerzenie na `.zip`).
2. Otwórz `widgets.json` i wyszukaj `"type":"cardDeck"`.
3. Obok jest `"id":"…"` i zwykle `"label"` z nazwą talii.

Talie bez `PCIO` są w eksporcie pomijane.

## 3. Eksportuj

Kliknij **Eksport do playingcards.io**. Generator:
- renderuje każdy wzór karty jako obraz JPG (rewersy także),
- zastępuje karty wskazanych talii nowymi, z liczbą kopii z kolumny `Ilość`,
- kładzie karty zakryte na stosie, na którym talia leżała,
- zostawia bez zmian resztę stołu: identyfikatory talii zostają, więc przyciski automatyzacji (tasowanie, zbieranie kart) dalej działają,
- usuwa z pliku stare, nieużywane obrazki kart.

Wynik zapisuje się jako `stol-karty.pcio`.

## 4. Wgraj na playingcards.io

W trybie edycji pokoju wybierz **Import room** i wskaż `stol-karty.pcio`.

## Uwagi

- Rozmiar obrazka karty ustawia `CONFIG.pcioRozmiar` w `karty.html` (domyślnie 560 px na dłuższym boku).
- Wymiary kart na stole (`cardWidth`, `cardHeight`) pochodzą z pokoju, nie z szablonu.
