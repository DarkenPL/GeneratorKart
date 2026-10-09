# Eksport do playingcards.io

[playingcards.io](https://playingcards.io) pozwala grać w karty przez przeglądarkę. Generator przygotowuje **nowy pokój** ze wszystkimi taliami projektu, żeby szybko zacząć ustawiać stół. Resztę (miejsca graczy, żetony, przyciski, plansze) dodajesz już w playingcards.io.

## 1. Eksportuj

Kliknij **Eksport do playingcards.io**. Generator:
- tworzy dla każdej talii osobny **stos** z nazwą talii, a stosy ustawia obok siebie w rzędach,
- kładzie na stosie wszystkie karty talii **zakryte**, z liczbą kopii z kolumny `Ilość`,
- zamienia każdy wzór karty i rewers na obraz JPG; karty mają proporcje z komendy `KARTA`, karty poziome są poziome,
- dla talii bez sekcji `[REWERS]` robi prosty ciemny rewers z nazwą talii.

Wynik zapisuje się w folderze projektu jako `NazwaProjektu – playingcards.pcio` (nazwa z komendy `PROJEKT`). Kolejny eksport nadpisuje ten plik. Przy przykładach aplikacja pyta, gdzie zapisać plik.

Eksport obejmuje wszystkie talie, także ukryte filtrem w podglądzie. Szablon nie potrzebuje żadnych dodatkowych komend.

## 2. Wgraj na playingcards.io

1. Utwórz nowy pokój i wejdź w tryb edycji (**Edit Table**).
2. Wybierz **Import room** i wskaż plik `.pcio`.
3. Ustaw stół: przesuń stosy, dodaj miejsca graczy, rękę, przyciski tasowania i inne elementy.

Gdy karty się zmienią, wyeksportuj pokój ponownie. Ustawienia stołu z poprzedniego pokoju trzeba wtedy odtworzyć, bo każdy eksport tworzy nowy pokój.

## Uwagi

- Plik `.pcio` to archiwum ZIP: `schemaVersion`, `widgets.json` (opis elementów stołu) i folder `userassets/` z obrazkami kart.
- Rozmiar obrazka karty ustawia `CONFIG.pcioRozmiar` w `karty.html` (domyślnie 560 px na dłuższym boku). Na stole dłuższy bok karty ma 160 jednostek.
- Komendy `STÓŁ` i `PCIO` z wcześniejszych wersji (podmiana talii w istniejącym pokoju) nie są już używane. Aplikacja pokazuje przy nich uwagę, a wiersze możesz usunąć z szablonu.
