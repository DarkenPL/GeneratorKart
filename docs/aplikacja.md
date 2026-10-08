# Aplikacja Generator kart

## Pobieranie

**[Pobierz najnowszą wersję](https://github.com/DarkenPL/GeneratorKart/releases/latest/download/Generator-kart-mac.zip)** (`Generator-kart-mac.zip`).

Aplikacja działa na Macach z procesorem Apple (M1–M4). Jaki masz procesor, sprawdzisz w  → **Ten Mac** (pozycja „Układ”).

Plik budowany jest automatycznie po każdej zmianie w gałęzi `main`. Wersja robocza z pull requestu jest w zakładce **Actions** → uruchomienie „Aplikacja macOS” → **Artifacts**.

## Instalacja i pierwsze uruchomienie

1. Rozpakuj ZIP i przeciągnij **Generator kart** do folderu **Programy**.
2. Aplikacja nie jest podpisana certyfikatem Apple (wymaga płatnego konta deweloperskiego), więc przy pierwszym uruchomieniu macOS ją zablokuje. Odblokowujesz ją raz:
   - kliknij aplikację **prawym przyciskiem → Otwórz → Otwórz**,
   - albo, jeśli macOS pokaże tylko „Gotowe/Przenieś do Kosza”: otwórz **Ustawienia systemowe → Prywatność i ochrona**, przewiń w dół i kliknij **Otwórz mimo to** przy „Generator kart”.

   Gdyby macOS twierdził, że aplikacja jest „uszkodzona”, wpisz w Terminalu:

   ```
   xattr -dr com.apple.quarantine "/Applications/Generator kart.app"
   ```

## Praca

1. **Plik → Otwórz szablon… (⌘O)** i wskaż plik szablonu (`.txt`) swojej gry.
   - Szablon wskazuje resztę plików: dane kart (`DANE = …`), obrazki, czcionki, pokój playingcards.io.
   - Ścieżki liczą się od folderu projektu: tego, w którym leży szablon, albo folderu nad `Szablony`, gdy szablon leży w takim podfolderze.
   - Szablon możesz też otworzyć z Findera: prawy przycisk → **Otwórz za pomocą → Generator kart**.
2. Karty odświeżają się same po każdym zapisie szablonu, pliku z kartami albo obrazka.
3. Aplikacja pamięta ostatnie szablony (**Plik → Ostatnie projekty**) i przy starcie otwiera ostatni.

| Skrót | Działanie |
|---|---|
| ⌘O | Otwórz szablon |
| ⌘S | Zapisz PDF (A4 ze znacznikami albo „każda karta na osobnej stronie” – wg wyboru w pasku) |
| ⌘P | Drukuj (systemowe okno drukowania) |
| ⌘E | Eksport JPG do folderu `Export` projektu |
| ⌘R | Odśwież karty |

- **Eksport JPG** zapisuje każdą kartę (i rewersy) jako osobny plik w folderze `Export` obok szablonu albo folderu `Szablony`. Pliki o tych samych nazwach są nadpisywane, inne pliki w `Export` zostają.
- **Plik `.pcio`** z eksportu do playingcards.io zapisuje się domyślnie w folderze projektu.
- **Przykłady** są tylko do odczytu. Eksport JPG pyta wtedy o folder. Żeby zmieniać przykład, skopiuj jego folder z repozytorium i otwórz szablon kopii.

## Dla deweloperów

```
cd app
npm ci
npm start          # zasoby + uruchomienie
npm run dist       # budowanie .app (na macOS)
```

- `app/generator/karty.html`: interfejs i cały silnik generatora (jeden plik HTML).
- `app/main.js`: okno, menu, ostatnie projekty, zapis PDF, eksport do `Export/`, podmiana adresów CDN na zasoby lokalne.
- `app/serwer.js`: lokalny serwer HTTP, który podaje pliki projektu.
- `app/scripts/zasoby.js`: kopiuje generator, przykłady, biblioteki i czcionki do `app/zasoby/`.
- Tryb testowy: `Generator kart --test-pdf <szablon.txt|folder|-> <wynik.pdf>` otwiera projekt, sprawdza eksport JPG (poza przykładami także do `Export/`), zapisuje PDF i zrzut ekranu, a potem kończy z kodem 0 albo 1. `-` oznacza ekran powitalny.
- `.github/workflows/aplikacja-mac.yml`: budowanie i testy na macOS. Po każdej zmianie w `main` aktualizuje wydanie „Najnowsza wersja”.

### Wydanie z numerem wersji

1. Ustaw `version` w `app/package.json`.
2. Na GitHubie: **Releases → Draft a new release**, tag np. `v0.2.0` (**Create new tag**), **Publish release**.

Workflow dołączy do wydania plik ZIP po kilku minutach.
