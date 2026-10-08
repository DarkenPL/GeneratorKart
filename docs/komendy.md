# Komendy szablonów

Wygląd kart opisują pliki tekstowe w folderze `Szablony/` projektu, w stylu [nanDecka](https://www.nandeck.com/). Każda linia to jedna komenda:

```
KOMENDA = argument, argument, opcja=wartość, flaga
```

## Zasady ogólne

- **Wymiary w milimetrach.** Punkt `(0, 0)` to lewy górny róg karty. Można liczyć: `88 - 1.6 - 10.35`. Ułamki zapisuje się z kropką: `3.5`.
- **Rozmiar czcionki w punktach (pt).**
- `[Kolumna]` wstawia wartość z pliku danych (CSV/XLSX), np. `[Nazwa]`.
- `{znacznik}` wstawia ikonę z `ikony.csv` (patrz niżej). Działa też w danych.
- `"tekst"` w cudzysłowie może zawierać przecinki. `\n` oznacza nową linię, `**pogrubienie**` i `*kursywa*` formatują tekst.
- Komentarz zaczyna się od `;` albo `#` na początku linii. Komentarz na końcu linii zaczyna się od ` ;` (ze spacją przed średnikiem).
- Nazwy komend i opcji można pisać z polskimi znakami lub bez (`TŁO` = `TLO`, `wyrównanie` = `wyrownanie`). Wielkość liter nie ma znaczenia.
- Elementy rysowane są w kolejności: następny przykrywa poprzedni.

### Pliki szablonów

- Każdy plik `.txt` w `Szablony/` to jedna talia albo, z sekcjami `[TALIA …]`, kilka talii.
- Pliki czytane są w kolejności nazw, a talie w pliku od góry.
- Pomijane są pliki zaczynające się od `_` (np. `_notatki.txt`) oraz podfoldery.
- Edytuj jako **zwykły tekst** (TextEdit: Format → Zamień na zwykły tekst) albo w edytorze kodu. Plik zapisany jako RTF generator wykryje i poda, jak to naprawić.

## Talia i projekt

| Komenda | Opis |
|---|---|
| `NAZWA = Przedmioty` | Nazwa talii (podgląd, pliki JPG, eksport). Domyślnie nazwa z `[TALIA …]` albo z nazwy pliku. |
| `DANE = przedmioty.csv, przedmioty.xlsx` | Plik(i) z kartami. Pierwszy znaleziony wygrywa. |
| `KARTA = 63, 88, zaokrąglenie=3, obwódka=0.7, kolor_obwódki=#222222` | Szerokość i wysokość karty w mm. Opcjonalnie zaokrąglone rogi i obwódka całej karty (rysowana na wierzchu). W sekcji `[REWERS]` ustawia tylko rogi i obwódkę rewersu; rozmiar jest zawsze jak awersu. |
| `KOLOR = las, #7BA05B` | Nazwany kolor (paleta wspólna dla wszystkich szablonów). Nazwy można używać w danych i szablonie zamiast kodu, np. `TŁO = [Kolor] \| las`, a także jako ikony-prostokąta `{kolor-las}` (`{kolor-las-mix}` jest w połowie biały). |
| `PCIO = 3f2a9c1e-…` | Identyfikator talii w pokoju playingcards.io, którą zastępuje eksport. Bez tej komendy talia jest pomijana w eksporcie. Patrz [playingcards.md](playingcards.md). |
| `STÓŁ = stol.pcio` | Plik pokoju playingcards.io, do którego eksport wstawia talie. Bez tej komendy generator poprosi o plik. |

### Plik danych (CSV / XLSX)

- Pierwszy wiersz zawiera nazwy kolumn.
- Separator to `;` albo `,` (wykrywany sam). Kodowanie UTF-8.
- W pliku XLSX czytany jest pierwszy arkusz.
- Kolumna **`Ilość`** określa liczbę kopii karty: `0` pomija kartę, a brak kolumny oznacza 1.
- Kolumna **`ID`** służy jako numer karty (podgląd, nazwy plików JPG).
- Nowa linia w komórce to nowa linia na karcie.

### Ikony – `ikony.csv`

```
Znacznik;Znak;Odstęp;Plik;Opis
{drewno};🪵;tak;Ikony/drewno.svg;Surowiec: drewno
```

| Kolumna | Opis |
|---|---|
| Znacznik | Używany w tekście, np. `{drewno}`. |
| Znak | Emoji zastępcze, gdy brakuje pliku. |
| Odstęp | `tak` = mały odstęp, gdy zaraz po ikonie stoi kolejna. |
| Plik | Ścieżka do obrazka (PNG, JPG, SVG). |
| Opis | Dowolny, dla Ciebie. |

## Sekcje

| Sekcja | Opis |
|---|---|
| `[TALIA Nazwa]` | Zaczyna kolejną talię w tym samym pliku. Wszystko przed pierwszą `[TALIA …]` jest **wspólne** dla talii z pliku: `KARTA`, `CZCIONKA` oraz elementy awersu i rewersu, rysowane pod elementami talii. Każda talia potrzebuje własnego `DANE`. Talia może nadpisać wspólne `KARTA` albo `CZCIONKA`. Dwie talie o tej samej nazwie: druga jest pomijana (z uwagą). |
| `[REWERS]` | Poniżej rysuje się rewers talii, wspólny dla wszystkich jej kart. Bez tej sekcji talia nie ma rewersu. Na rewersie pola `[Kolumna]` są puste. |
| `[AWERS]` | Powrót do rysowania awersu. |

## Elementy

### `TŁO = [Kolor] | #cccccc`
Tło całej karty.
- `|` oznacza: jeśli pierwszy kolor jest pusty, weź następny.
- Kolor można podać jako `#RRGGBB`, `#RRGGBBAA` (z przezroczystością), nazwę z palety (`KOLOR`) albo `brak`.
- Zamiast koloru można podać obrazek: `TŁO = Art/tlo.png`.

### `PROSTOKĄT = x, y, szer, wys, kolor=#ffffff`
Opcje:
- `kolor` – domyślnie czarny; `brak` = bez wypełnienia,
- `zaokrąglenie` – w mm albo w `%`,
- `obwódka` – grubość w mm,
- `kolor_obwódki`,
- `krycie` – od 0 do 1.

### `ELIPSA = x, y, szer, wys, kolor=…`
Jak `PROSTOKĄT`, ale okrągła.

### `TEKST = x, y, szer, wys, "treść z [Kolumnami]", opcje…`

| Opcja | Znaczenie |
|---|---|
| `czcionka="EB Garamond, Georgia, serif"` | czcionka (zapasowe po przecinku) |
| `rozmiar=10` | wielkość w pt |
| `kolor=#1d1b19` | kolor tekstu |
| `wyrównanie=lewo \| środek \| prawo \| wyjustuj` | w poziomie |
| `pion=góra \| środek \| dół` | w pionie |
| `interlinia=1.15` | odstęp między liniami |
| `ikony=0.9` | wysokość ikon względem tekstu (`1.8` = 2× większe) |
| `min=0.6` | najmniejsza skala, gdy tekst się nie mieści |
| `grupa=nazwa` | pola z tą samą grupą zmniejszają się razem (na wszystkich kartach talii o tyle samo) i nie mogą na siebie nachodzić, np. koszt z lewej i punkty z prawej w jednym wierszu |

Flagi: `pogrubienie`, `kursywa`, `podkreślenie`, `wersaliki`, `jedna_linia`.

- Za długi tekst zmniejsza się sam. Jeśli nadal się nie mieści, karta dostaje w podglądzie czerwoną ramkę, a w Uwagach pojawia się wpis.
- Jeśli **wszystkie** `[Kolumny]` w treści są puste, element nie jest rysowany. Na przykład `"**Efekt:** [Efekt]"` znika, gdy Efekt jest pusty.

### `OBRAZEK = x, y, szer, wys, [Obrazek], pion=dół`
Plik obrazka podany w kolumnie albo wprost, np. `Art/lis.png`. Obsługiwane formaty to PNG, JPG, SVG, GIF i WEBP.

Opcje:
- `dopasuj=zmieść | wypełnij | rozciągnij`,
- `wyrównanie=lewo | środek | prawo`,
- `pion=góra | środek | dół`.

### `IKONA = x, y, szer, wys, {znacznik}`
Ikona (lub kilka) o wysokości pola, wyśrodkowana. Opcje: `wyrównanie`, `pion`.

### `CZCIONKA = "EB Garamond, Georgia, serif", 10, kolor=#1d1b19`
Domyślna czcionka, rozmiar i inne opcje (także flagi, np. `kursywa`) dla kolejnych `TEKST`-ów. Działa do następnej `CZCIONKA`.

### `CZCIONKA_PLIK = "Moja Czcionka", Fonts/MojaCzcionka.ttf`
Czcionka z pliku w folderze projektu. Potem używasz jej jako `czcionka="Moja Czcionka"`. Czcionki zainstalowane w systemie działają bez tej komendy.

### `CZCIONKA_GOOGLE = Lobster`
Czcionka z Google Fonts (wymaga internetu). Można podać pełny zapis z wariantami w cudzysłowie, np. `"EB Garamond:ital,wght@0,400;0,600;1,400"`.

Wbudowane są **EB Garamond** i **Patrick Hand**.

## Warunki – `jeśli=`

Każdy element może mieć opcję `jeśli=`:

| Zapis | Element rysowany, gdy… |
|---|---|
| `jeśli=[Kolor2]` | kolumna nie jest pusta |
| `jeśli=[Typ]=burza` | wartość jest równa (bez względu na wielkość liter; `001` = `1`) |
| `jeśli=[Typ]!=burza` | wartość jest inna |

Przykład – złota ramka tylko dla rzadkich kart:

```
PROSTOKĄT = 1.5, 1.5, 60, 85, kolor=brak, obwódka=1.2, kolor_obwódki=#C9A227, jeśli=[Rzadka]=tak
```
