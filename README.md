# Generator kart

Generator kart do gier planszowych i karcianych. Karty trzymasz w arkuszu (CSV albo XLSX), wygląd opisujesz prostym plikiem tekstowym w stylu [nanDecka](https://www.nandeck.com/), a generator na bieżąco pokazuje gotowe karty. Z generatora możesz:

- **wydrukować karty** na A4 ze znacznikami cięcia (karty 1:1, np. 63×88 mm) i z rewersami do druku dwustronnego,
- **wyeksportować obrazki JPG** każdej karty,
- **wgrać karty do pokoju [playingcards.io](https://playingcards.io)**, podmieniając talie w istniejącym stole.

![Przykładowe karty](docs/img/przyklady.png)

Całość to jeden plik `karty.html`, który działa w przeglądarce, bez instalowania czegokolwiek.

## Szybki start (macOS)

1. Pobierz to repozytorium (**Code → Download ZIP**) i rozpakuj.
2. Kliknij dwukrotnie **`Uruchom generator.command`**.
   - Przy pierwszym uruchomieniu macOS może zapytać o zgodę: kliknij plik prawym przyciskiem → **Otwórz**.
   - Otworzy się okno Terminala (to lokalny serwer, działa tylko na Twoim komputerze) i przeglądarka.
3. W przeglądarce wybierz jeden z **przykładowych projektów**.

Żeby zakończyć, zamknij okno Terminala.

### Własny projekt

1. Utwórz folder gry i skopiuj do niego `karty.html` oraz `Uruchom generator.command`.
2. Dodaj plik z kartami (np. `karty.csv`) i folder `Szablony/` z szablonem (zacznij od kopii przykładu).
3. Uruchom `Uruchom generator.command` z folderu gry. Generator wczyta pliki z tego folderu i będzie odświeżać karty po każdym zapisie.

Bez uruchamiania serwera możesz też otworzyć `karty.html` bezpośrednio w Chrome lub Edge i kliknąć **Wybierz folder projektu…**.

## Jak to działa

```
moja-gra/
├── karty.html                  generator
├── Uruchom generator.command   start (macOS)
├── karty.csv                   dane kart – jeden wiersz = jedna karta
├── ikony.csv                   znaczniki ikon, np. {drewno} → Ikony/drewno.svg
├── Ikony/, Art/                obrazki
└── Szablony/
    └── gra.txt                 wygląd kart
```

**`karty.csv`**

```
ID;Ilość;Nazwa;Rodzaj;Koszt;Efekt
1;3;Miecz;broń;{drewno}{zloto};Zadaj 2 obrażenia.
```

**`Szablony/gra.txt`**

```
NAZWA = Przedmioty
DANE  = karty.csv
KARTA = 63, 88

KOLOR = broń, #C0504D

TŁO       = [Rodzaj]
PROSTOKĄT = 3.5, 3.5, 56, 81, kolor=#ffffff, zaokrąglenie=4
TEKST     = 6, 5.5, 51, 9, [Koszt], ikony=1.8
TEKST     = 6, 64, 51, 9, [Nazwa], rozmiar=14, wyrównanie=środek
TEKST     = 6, 51, 51, 12, "**Efekt:** [Efekt]"
```

Wymiary są w milimetrach, `[Kolumna]` wstawia wartość z arkusza, `{znacznik}` wstawia ikonę. Za długi tekst zmniejsza się sam.

## Przykłady

| Projekt | Co pokazuje |
|---|---|
| [`01-wyprawa`](przyklady/01-wyprawa) | najprostsza talia: kolor z kolumny, tytuł, obrazek, opis |
| [`02-kuznia`](przyklady/02-kuznia) | ikony w tekście, koszt i punkty w jednym wierszu (`grupa=`), pole znikające przy pustej kolumnie, rewers |
| [`03-ogrod`](przyklady/03-ogrod) | dwie talie w jednym pliku, karta pozioma, warunki `jeśli=`, wspólna paleta kolorów |

## Dokumentacja

- [Komendy szablonów](docs/komendy.md) – pełna lista
- [Nowa talia krok po kroku](docs/nowa-talia.md)
- [Eksport do playingcards.io](docs/playingcards.md)

### Druk

Wybierz **Druk: A4 ze znacznikami cięcia** i kliknij **Drukuj / zapisz PDF**. W oknie drukowania ustaw:
- papier A4,
- **skalę 100%**,
- **marginesy: brak**.

Karty poziome są na arkuszu obracane, więc wszystkie strony mają ten sam format. Po każdym arkuszu kart jest arkusz rewersów. Najpewniejszy wynik daje Chrome.

## Wymagania

- Przeglądarka: Chrome lub Edge (pełne wsparcie), Safari i Firefox przez `Uruchom generator.command`.
- Do eksportu JPG, playingcards.io i plików XLSX potrzebny jest internet: biblioteki pobierane są z jsDelivr.
- `Uruchom generator.command` korzysta z wbudowanego w macOS Perla. Nic nie trzeba instalować.

## Licencje

Ikony w przykładach pochodzą z [game-icons.net](https://game-icons.net) (CC BY 3.0). Autorzy są wymienieni w [CREDITS.md](CREDITS.md).
