# Aplikacja na Maca

**Generator kart.app** to ten sam generator co `karty.html`, ale jako zwykła aplikacja z ikoną:

- nie potrzebuje okna Terminala ani przeglądarki,
- działa bez internetu (biblioteki eksportu i czcionki są w środku),
- pamięta ostatnio otwarte projekty (menu **Plik → Ostatnie projekty**),
- ma przycisk **Zapisz PDF**, który zapisuje plik od razu w dokładnym rozmiarze (A4 ze znacznikami cięcia albo każda karta osobno), bez okna drukowania i bez pilnowania skali i marginesów,
- zawiera przykładowe projekty (menu **Plik → Przykłady**).

## Pobieranie

- **Wydanie:** na stronie repozytorium wejdź w **Releases** i pobierz plik dla swojego Maca.
- **Najnowsza wersja robocza:** zakładka **Actions** → ostatnie uruchomienie „Aplikacja macOS” → sekcja **Artifacts**.

| Plik | Dla Maca |
|---|---|
| `Generator-kart-mac-AppleSilicon.zip` | z procesorem Apple M1–M4 (większość Maców od 2021 r.) |
| `Generator-kart-mac-Intel.zip` | z procesorem Intel |

Jaki masz procesor, sprawdzisz w  → **Ten Mac** („Układ” albo „Procesor”).

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

1. **Plik → Otwórz projekt… (⌘O)** i wskaż folder gry: plik kart (CSV/XLSX) i folder `Szablony`. Folder z kopią `karty.html` też zadziała, bo aplikacja zawsze używa własnej, wbudowanej wersji generatora.
2. Karty odświeżają się same po każdym zapisie pliku.

| Skrót | Działanie |
|---|---|
| ⌘S | Zapisz PDF (A4 albo „każda karta na osobnej stronie” – wg wyboru w pasku) |
| ⌘P | Drukuj (systemowe okno drukowania) |
| ⌘E | Eksport JPG |
| ⌘R | Odśwież karty |

Pliki JPG i `.pcio` zapisują się domyślnie w folderze projektu.

Przykłady są tylko do odczytu. Żeby na nich eksperymentować, skopiuj folder przykładu, na przykład z repozytorium, i otwórz kopię.

## Dla deweloperów

```
cd app
npm ci
npm start          # zasoby + uruchomienie
npm run dist       # budowanie .app (na macOS)
```

- `app/main.js`: okno, menu, ostatnie projekty, zapis PDF, podmiana adresów CDN na zasoby lokalne.
- `app/serwer.js`: lokalny serwer HTTP, ten sam protokół co `Uruchom generator.command`.
- `app/scripts/zasoby.js`: kopiuje `karty.html`, przykłady, biblioteki i czcionki do `app/zasoby/`.
- Tryb testowy: `Generator kart --test-pdf <folder> <wynik.pdf>` otwiera projekt, sprawdza eksport JPG, zapisuje PDF i zrzut ekranu, a potem kończy z kodem 0 albo 1. Folder `-` oznacza ekran powitalny.
- `.github/workflows/aplikacja-mac.yml`: budowanie na macOS przy każdej zmianie, tag `v*` tworzy wydanie.
