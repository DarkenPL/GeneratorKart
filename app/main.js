'use strict';
// KarKa (Kawia Karciana, dawniej Generator kart) – aplikacja na macOS (Electron).
// Okno pokazuje generator (generator/karty.html). Pliki projektu podaje lokalny serwer (serwer.js),
// a biblioteki i czcionki są w aplikacji. Projekt otwiera się przez wskazanie pliku szablonu.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { utworzSerwer } = require('./serwer');
const historia = require('./historia');
const aktualizacje = require('./aktualizacje');

// Kod aplikacji: z paczki albo z nakładki po aktualizacji (start.js, nakladka.js). Zasoby leżą obok kodu
// (nakładka, npm start) albo – w paczce – w Contents/Resources/zasoby.
const KOD = global.GENERATOR_KOD || { zrodlo: 'paczka', dir: __dirname, wersja: app.getVersion(), wbudowana: app.getVersion() };
const WERSJA = KOD.wersja;
const ZASOBY = fs.existsSync(path.join(__dirname, 'zasoby', 'karty.html')) ? path.join(__dirname, 'zasoby') : path.join(process.resourcesPath, 'zasoby');
const PRZYKLADY = path.join(ZASOBY, 'przyklady');
const DOKUMENTACJA = 'https://github.com/DarkenPL/KarKa#readme';

let okno = null;
let szablon = null;          // otwarty plik szablonu (.txt)
let projekt = null;          // folder projektu: folder szablonu, a gdy szablon leży w „Szablony” – folder nad nim
let port = 0;
let testowy = false;         // tryb testowy (CI) – bez otwierania okien Findera
let zmiany = false;          // niezapisane zmiany w edytorze szablonu

// ── Ustawienia: ostatnie projekty ──────────────────────────────────────────
// Pierwszy start po zmianie nazwy (Generator kart → KarKa): ustawienia ze starego folderu danych.
aktualizacje.przeniesDane(path.join(app.getPath('appData'), 'Generator kart'), app.getPath('userData'));
const plikUstawien = () => path.join(app.getPath('userData'), 'ustawienia.json');
function ustawienia() {
  try { return JSON.parse(fs.readFileSync(plikUstawien(), 'utf8')); } catch (e) { return { ostatnie: [] }; }
}
function zapiszUstawienia(u) {
  try { fs.mkdirSync(path.dirname(plikUstawien()), { recursive: true }); fs.writeFileSync(plikUstawien(), JSON.stringify(u, null, 2)); }
  catch (e) { /* bez zapisu ustawień aplikacja nadal działa */ }
}
// Przykłady są tylko do odczytu – także te z paczki, gdy działa nakładka (ostatnie projekty mogą wskazywać oba miejsca).
const FOLDERY_PRZYKLADOW = [...new Set([PRZYKLADY, path.join(process.resourcesPath || '', 'zasoby', 'przyklady')].map((p) => path.resolve(p)))];
const jestPrzykladem = (p) => !!p && FOLDERY_PRZYKLADOW.some((f) => path.resolve(p).startsWith(f + path.sep));
const jestPlikiem = (p) => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
const jestFolderem = (p) => { try { return fs.statSync(p).isDirectory(); } catch (e) { return false; } };

// Folder podany zamiast szablonu (np. z poprzedniej wersji) → pierwszy szablon w nim albo w jego „Szablony”.
function szablonZFolderu(dir) {
  for (const d of [path.join(dir, 'Szablony'), dir]) {
    try {
      const t = fs.readdirSync(d).filter((n) => /\.txt$/i.test(n) && !n.startsWith('_') && !n.startsWith('.'))
        .sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
      if (t.length) return path.join(d, t[0]);
    } catch (e) { /* brak folderu */ }
  }
  return null;
}
const naSzablon = (p) => (!p ? null : jestPlikiem(p) ? p : jestFolderem(p) ? szablonZFolderu(p) : null);
const ostatnie = () => [...new Set((ustawienia().ostatnie || []).map(naSzablon).filter(Boolean))];
const folderProjektu = (plik) => {
  const dir = path.dirname(plik);
  return path.basename(dir).toLowerCase() === 'szablony' ? path.dirname(dir) : dir;
};
const nazwaProjektu = () => (projekt ? path.basename(projekt) : '');

// ── Projekt ─────────────────────────────────────────────────────────────────
// Niezapisane zmiany w edytorze: Zapisz / Nie zapisuj / Anuluj. Zwraca true, gdy można iść dalej.
async function czyMoznaPorzucic() {
  if (!zmiany || testowy || !okno) return true;
  const r = await dialog.showMessageBox(okno, {
    type: 'warning', buttons: ['Zapisz', 'Nie zapisuj', 'Anuluj'], defaultId: 0, cancelId: 2,
    message: `Zapisać zmiany w szablonie „${path.basename(szablon || '')}”?`,
    detail: 'Jeśli nie zapiszesz, zmiany przepadną.',
  });
  if (r.response === 2) return false;
  if (r.response === 0) {
    try { zapiszSzablonNaDysk(await okno.webContents.executeJavaScript('window.edytorTekst()')); }
    catch (e) { dialog.showErrorBox('Nie można zapisać szablonu', e.message); return false; }
  }
  zmiany = false;
  return true;
}
function zapiszSzablonNaDysk(tekst) {
  if (!szablon || jestPrzykladem(szablon)) throw new Error('Ten szablon jest tylko do odczytu.');
  fs.writeFileSync(szablon, String(tekst));
}

async function otworzSzablon(plik) {
  if (!(await czyMoznaPorzucic())) return;
  historiaZamkniecie();
  zmiany = false;
  if (okno) okno.setDocumentEdited(false);
  szablon = naSzablon(plik);
  projekt = szablon ? folderProjektu(szablon) : null;
  if (szablon && !jestPrzykladem(szablon)) {
    const u = ustawienia();
    u.ostatnie = [szablon, ...(u.ostatnie || []).map(naSzablon).filter((x) => x && x !== szablon)].slice(0, 10);
    zapiszUstawienia(u);
    app.addRecentDocument(szablon);
  }
  if (okno) {
    okno.setTitle(szablon ? `${nazwaProjektu()} – ${path.basename(szablon)} – KarKa` : 'KarKa');
    if (szablon) okno.setRepresentedFilename(szablon);
    const rel = szablon ? path.relative(projekt, szablon).split(path.sep).join('/') : '';
    okno.loadURL(`http://127.0.0.1:${port}/karty.html` + (rel ? '?szablon=' + encodeURIComponent(rel) : ''));
  }
  zbudujMenu();
}

async function wybierzSzablon() {
  const r = await dialog.showOpenDialog(okno, {
    title: 'Otwórz szablon kart', buttonLabel: 'Otwórz',
    message: 'Wybierz plik szablonu (.txt) – wskazuje on pliki z kartami i obrazki.',
    properties: ['openFile'],
    filters: [{ name: 'Szablon kart', extensions: ['txt'] }],
    defaultPath: szablon && !jestPrzykladem(szablon) ? path.dirname(szablon) : app.getPath('documents'),
  });
  if (!r.canceled && r.filePaths[0]) otworzSzablon(r.filePaths[0]);
  return !r.canceled;
}

// ── Nowy projekt ────────────────────────────────────────────────────────────
// Folder gry z szablonem startowym (zasoby/szablon-startowy): szablon, karty.csv, ikony, obrazek.
const STARTOWY = path.join(ZASOBY, 'szablon-startowy');
function utworzProjekt(folder) {
  if (fs.existsSync(folder) && fs.readdirSync(folder).some((n) => !n.startsWith('.')))
    throw new Error(`Folder „${path.basename(folder)}” już istnieje i nie jest pusty – wybierz inną nazwę.`);
  const nazwa = path.basename(folder);
  const wCudzyslowie = nazwa.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const wstaw = (t) => t.replace(/\{\{NAZWA_W_CUDZYSLOWIE\}\}/g, () => wCudzyslowie).replace(/\{\{NAZWA\}\}/g, () => nazwa);
  fs.cpSync(STARTOWY, folder, { recursive: true });
  for (const plik of ['Szablony/gra.txt', 'CZYTAJ.txt']) {
    const p = path.join(folder, plik);
    fs.writeFileSync(p, wstaw(fs.readFileSync(p, 'utf8')));
  }
  return path.join(folder, 'Szablony', 'gra.txt');
}

async function nowyProjekt() {
  const r = await dialog.showSaveDialog(okno, {
    title: 'Nowy projekt', buttonLabel: 'Utwórz', nameFieldLabel: 'Nazwa gry:',
    message: 'Powstanie folder gry z przykładowym szablonem, plikiem kart i ikonami.',
    defaultPath: path.join(app.getPath('documents'), 'Nowa gra'),
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  });
  if (r.canceled || !r.filePath) return false;
  if (!(await czyMoznaPorzucic())) return false;
  try { otworzSzablon(utworzProjekt(r.filePath)); return true; }
  catch (e) { dialog.showErrorBox('Nie można utworzyć projektu', e.message); return false; }
}

const listaPrzykladow = () => {
  try { return fs.readdirSync(PRZYKLADY).filter((n) => !n.startsWith('.') && jestFolderem(path.join(PRZYKLADY, n))).sort(); }
  catch (e) { return []; }
};

// ── PDF ─────────────────────────────────────────────────────────────────────
// Zapis wprost do pliku – w rozmiarze stron z @page (A4 albo rozmiar karty), bez okna drukowania.
async function pdfDoPliku(webContents, plik) {
  const dane = await webContents.printToPDF({ printBackground: true, preferCSSPageSize: true, margins: { marginType: 'none' } });
  fs.writeFileSync(plik, dane);
  return plik;
}

ipcMain.handle('projekt:info', () => ({
  auto: ustawienia().auto !== false,
  szablon, sciezka: projekt, nazwa: nazwaProjektu(), przyklad: jestPrzykladem(szablon),
}));
ipcMain.handle('projekt:otworz', () => wybierzSzablon());
ipcMain.handle('edytor:zapisz', (e, tekst) => { zapiszSzablonNaDysk(tekst); zmiany = false; if (okno) okno.setDocumentEdited(false); return true; });
ipcMain.handle('edytor:zmiany', (e, czy) => { zmiany = !!czy; if (okno) okno.setDocumentEdited(zmiany); });
ipcMain.handle('projekt:nowy', () => nowyProjekt());
ipcMain.handle('projekt:przyklady', () => listaPrzykladow());
ipcMain.handle('projekt:przyklad', (e, nazwa) => {
  const p = path.join(PRZYKLADY, path.basename(String(nazwa)));
  if (jestFolderem(p)) otworzSzablon(p);
});
ipcMain.handle('projekt:pokaz', () => { if (projekt) shell.openPath(projekt); });

// ── Eksport JPG do folderu Export ───────────────────────────────────────────
// Przykłady są tylko do odczytu – wtedy pytamy, gdzie zapisać.
let folderEksportu = null;
// cel: undefined = Export, 'katalog' = Export/katalog, 'zlecenie' = .generator/katalog (czyszczony).
ipcMain.handle('eksport:start', async (e, cel) => {
  const pod = cel === 'katalog' ? ['katalog'] : [];
  if (cel === 'zlecenie') {
    if (!projekt || jestPrzykladem(projekt)) return null;
    folderEksportu = path.join(projekt, '.generator', 'katalog');   // nie w zlecenia/ – tam plik zlecenia „katalog”
    fs.rmSync(folderEksportu, { recursive: true, force: true });
  } else if (projekt && !jestPrzykladem(projekt)) folderEksportu = path.join(projekt, 'Export', ...pod);
  else {
    const r = await dialog.showOpenDialog(okno, {
      title: 'Gdzie zapisać obrazki?', buttonLabel: 'Wybierz', properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('documents'),
    });
    if (r.canceled || !r.filePaths[0]) return null;
    folderEksportu = path.join(r.filePaths[0], 'Export', ...pod);
  }
  fs.mkdirSync(folderEksportu, { recursive: true });
  return folderEksportu;
});
ipcMain.handle('eksport:plik', (e, nazwa, dane) => {
  if (!folderEksportu) throw new Error('Eksport nie został rozpoczęty');
  fs.writeFileSync(path.join(folderEksportu, path.basename(String(nazwa))), Buffer.from(dane));
});
ipcMain.handle('eksport:koniec', () => { if (folderEksportu && !testowy) shell.openPath(folderEksportu); });
// Eksport playingcards.io: plik .pcio w folderze projektu (przykłady – okno zapisu).
ipcMain.handle('pcio:zapisz', async (e, nazwa, dane) => {
  let plik;
  const czysta = path.basename(String(nazwa || 'karty.pcio')).replace(/[\\/:*?"<>|]+/g, '_');
  if (projekt && !jestPrzykladem(projekt)) plik = path.join(projekt, czysta);
  else {
    const r = await dialog.showSaveDialog(okno, { title: 'Zapisz pokój playingcards.io',
      defaultPath: path.join(app.getPath('documents'), czysta), filters: [{ name: 'playingcards.io', extensions: ['pcio'] }] });
    if (r.canceled || !r.filePath) return null;
    plik = r.filePath;
  }
  fs.writeFileSync(plik, Buffer.from(dane));
  return plik;
});
ipcMain.handle('pdf:zapisz', async (e, nazwa) => {
  const katalog = projekt && !jestPrzykladem(projekt) ? projekt : app.getPath('documents');
  const r = await dialog.showSaveDialog(okno, {
    title: 'Zapisz PDF', defaultPath: path.join(katalog, `${nazwa || 'karty'}.pdf`),
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled || !r.filePath) return null;
  await pdfDoPliku(e.sender, r.filePath);
  return r.filePath;
});

// ── Odciski kart z ostatniego PDF (druk tylko zmienionych, porównanie) ──────
// Jeden plik JSON na szablon w danych aplikacji – folder projektu zostaje czysty, działa też dla przykładów.
const plikOdciskow = () => szablon && path.join(app.getPath('userData'), 'odciski',
  require('crypto').createHash('sha1').update(szablon).digest('hex').slice(0, 16) + '.json');
// Ostatnie ustawienia okien druku i eksportu – osobno dla każdego szablonu.
const plikUstawienEksportu = () => szablon && path.join(app.getPath('userData'), 'eksport',
  require('crypto').createHash('sha1').update(szablon).digest('hex').slice(0, 16) + '.json');
ipcMain.handle('eksport:ustawienia', () => {
  try { return JSON.parse(fs.readFileSync(plikUstawienEksportu(), 'utf8')); } catch (e) { return {}; }
});
ipcMain.handle('eksport:zapiszUstawienia', (e, dane) => {
  const p = plikUstawienEksportu(); if (!p) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(dane || {}, null, 1));
  return true;
});
ipcMain.handle('druk:odciski', () => {
  try { return JSON.parse(fs.readFileSync(plikOdciskow(), 'utf8')); } catch (e) { return null; }
});
ipcMain.handle('druk:zapiszOdciski', (e, dane) => {
  const p = plikOdciskow(); if (!p) return false;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(dane));
  return true;
});

// ── Historia wersji (folder .historia w projekcie; przykłady – bez historii) ─
const historiaDostepna = () => projekt && !jestPrzykladem(projekt);
ipcMain.handle('historia:zapisz', (e, pliki, punkt) =>
  historiaDostepna() ? historia.zapisz(projekt, (pliki || []).map(String), punkt || null) : 0);
ipcMain.handle('historia:lista', () => historiaDostepna() ? historia.wczytajIndeks(projekt) : null);
ipcMain.handle('historia:stan', (e, czas) => historiaDostepna()
  ? historia.stan(projekt, Number(czas)).map((s) => ({ plik: s.plik, dane: new Uint8Array(s.dane) })) : []);
// Zamknięcie projektu (inny szablon, koniec aplikacji): kopia plików, które zmieniły się od ostatniej kopii.
// Pliki = te, które historia już śledzi (przy otwarciu projektu kopiowane są wszystkie).
function historiaZamkniecie() {
  if (!historiaDostepna()) return;
  try {
    const pliki = [...new Set(historia.wczytajIndeks(projekt).wersje.map((v) => v.plik))];
    if (pliki.length) historia.zapisz(projekt, pliki, { powod: 'zamknięcie', etykieta: 'zamknięcie projektu', jesliZmiany: true });
  } catch (e) { /* bez kopii – nie blokujemy zamykania */ }
}
// Skrzynka (.historia/przychodzace) – punkty od innych narzędzi, np. Claude; sprawdzana co 3 s.
setInterval(() => {
  if (!historiaDostepna() || !okno) return;
  try { if (historia.sprawdzSkrzynke(projekt)) okno.webContents.send('historia:zmiana'); } catch (e) { /* spróbujemy za chwilę */ }
}, 3000);
// Zlecenia z pliku (np. od Claude): .generator/zlecenia/<polecenie> w folderze otwartego projektu.
// Polecenia: katalog, stan, raport, pdf, obrazki, pcio. Treść (opcjonalnie): wiersze „klucz = wartość”
// (puste wiersze i komentarze # / ; pomijane). Otwarta aplikacja wykonuje zlecenia po kolei (jedno naraz),
// usuwa plik zlecenia i zapisuje wynik-<polecenie>.json (katalog także dawny wynik.json).
const FOLDER_ZLECEN = ['.generator', 'zlecenia'];
const POLECENIA = ['katalog', 'stan', 'raport', 'pdf', 'obrazki', 'pcio'];
let zlecenieTrwa = false;
function czytajZlecenie(tekst) {
  const o = {};
  for (const w of String(tekst).replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (/^\s*([#;]|$)/.test(w)) continue;
    const m = /^\s*([^=:]+?)\s*[=:]\s*(.*?)\s*$/.exec(w);
    if (m) o[m[1]] = m[2];
  }
  return o;
}
async function wykonajPlikZlecenia(polecenie) {
  const folder = path.join(projekt, ...FOLDER_ZLECEN), plik = path.join(folder, polecenie);
  let tekst;
  try { if (!fs.statSync(plik).isFile()) return false; tekst = fs.readFileSync(plik, 'utf8'); } catch (e) { return false; }
  // Strona jeszcze się wczytuje – spróbujemy przy następnym sprawdzeniu.
  const gotowa = await okno.webContents.executeJavaScript('!!(window.wykonajZlecenie && window.zbudowano)').catch(() => false);
  if (!gotowa) return false;
  const wyniki = [path.join(folder, `wynik-${polecenie}.json`)];
  if (polecenie === 'katalog') wyniki.push(path.join(folder, 'wynik.json'));     // zgodność z v0.4.6–0.4.10
  const naglowek = { zlecenie: polecenie, czas: new Date().toISOString(), szablon: szablon && path.relative(projekt, szablon), wersjaAplikacji: WERSJA };
  let wynik;
  try {
    wyniki.forEach((w) => fs.rmSync(w, { force: true }));
    const surowe = czytajZlecenie(tekst);
    const w = await okno.webContents.executeJavaScript(`wykonajZlecenie(${JSON.stringify(polecenie)}, ${JSON.stringify(surowe)})`);
    wynik = { ...naglowek, ok: false, pliki: [], blad: null, ...w };
    const wzgledna = (p) => (typeof p === 'string' && path.isAbsolute(p) ? path.relative(projekt, p) : p);
    wynik.pliki = (wynik.pliki || []).map(wzgledna);
    if (wynik.folder) wynik.folder = wzgledna(wynik.folder);
  } catch (e) {
    wynik = { ...naglowek, ok: false, pliki: [], blad: String((e && e.message) || e) };
  }
  try {
    fs.rmSync(plik, { force: true });                     // najpierw zlecenie – plik wyniku = koniec pracy
    for (const w of wyniki) fs.writeFileSync(w, JSON.stringify(wynik, null, 1));
  } catch (e) { /* trudno – folder zniknął */ }
  return true;
}
async function sprawdzZlecenia() {
  if (zlecenieTrwa || !historiaDostepna() || !okno) return;
  zlecenieTrwa = true;
  try {
    await zlecenieAktualizacji();
    for (const p of POLECENIA) if (projekt) await wykonajPlikZlecenia(p);
  }
  finally { zlecenieTrwa = false; }
}
setInterval(sprawdzZlecenia, 3000);
// PDF ze zlecenia: zapis bez okna, tylko w folderze projektu (domyślna nazwa jak przy ręcznym zapisie).
ipcMain.handle('zlecenie:pdf', async (e, nazwa) => {
  if (!zlecenieTrwa || !historiaDostepna()) throw new Error('zapis PDF bez okna działa tylko w zleceniu z pliku');
  let cel = path.resolve(projekt, String(nazwa || 'karty.pdf'));
  if (!/\.pdf$/i.test(cel)) cel += '.pdf';
  const rel = path.relative(projekt, cel);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('plik PDF musi być w folderze projektu');
  fs.mkdirSync(path.dirname(cel), { recursive: true });
  return pdfDoPliku(e.sender, cel);
});
ipcMain.handle('historia:przywroc', (e, czas) => {
  if (!historiaDostepna()) return { blad: 'Przykłady nie mają historii.' };
  if (zmiany) return { blad: 'Najpierw zapisz albo cofnij zmiany w edytorze szablonu.' };
  return { zmienione: historia.przywroc(projekt, Number(czas)) };
});

// ── Aktualizacje ─────────────────────────────────────────────────────────────
// Sprawdzanie: przy starcie (bez komunikatu, gdy brak nowej wersji albo internetu), z menu
// (KarKa → Sprawdź aktualizacje…) i zleceniem z pliku .generator/zlecenia/aktualizacja.
// Mała aktualizacja = nakładka kodu (restart), pełna = podmiana aplikacji po zamknięciu (aktualizacje.js).
const AKT = { trwa: false, podmiana: null };     // podmiana: { nowa, stara, wersja } – czeka na zamknięcie aplikacji
const MB = (b) => (b / 1048576).toLocaleString('pl-PL', { maximumFractionDigits: b < 10485760 ? 1 : 0 }) + ' MB';
const pobieraj = (u, o) => net.fetch(u, o);
const okienko = (o) => (okno ? dialog.showMessageBox(okno, o) : dialog.showMessageBox(o));
const postepAktualizacji = (f) => { if (okno) okno.setProgressBar(f == null ? -1 : f); };

function sprawdzWydanie() {
  return aktualizacje.sprawdz({ wersja: WERSJA, electron: process.versions.electron, fetch: pobieraj });
}
// Pobranie i instalacja według wyniku sprawdzWydanie(). Mała – od razu do <dane>/kod; pełna – nowa .app
// czeka na zamknięcie (AKT.podmiana).
async function zainstalujAktualizacje(info) {
  AKT.trwa = true; zbudujMenu();
  try {
    const dane = app.getPath('userData'), opcje = { fetch: pobieraj, postep: postepAktualizacji };
    if (info.rodzaj === 'kod') { await aktualizacje.zainstalujKod(info, dane, opcje); return; }
    const stara = aktualizacje.folderAplikacji();
    if (!aktualizacje.moznaPodmienic(stara)) throw new Error(stara ? `Brak prawa zapisu w folderze ${path.dirname(stara)}.` : 'Aplikacja nie działa z paczki .app.');
    AKT.podmiana = { nowa: await aktualizacje.przygotujPelna(info, dane, opcje), stara, wersja: info.najnowsza };
  } finally { AKT.trwa = false; postepAktualizacji(null); zbudujMenu(); }
}
function uruchomPodmiane(uruchom) {
  const p = AKT.podmiana;
  if (!p) return;
  AKT.podmiana = null;
  aktualizacje.uruchomPodmiane(aktualizacje.zaplanujPodmiane({ nowa: p.nowa, stara: p.stara, uruchom, dane: app.getPath('userData') }));
}
// Zamknięcie i start nowej wersji (bez pytania – niezapisany szablon sprawdza wcześniej wywołujący).
function zrestartuj() {
  zmiany = false;
  if (AKT.podmiana) uruchomPodmiane(true); else app.relaunch();
  app.quit();
}
app.on('will-quit', () => uruchomPodmiane(false));         // pełna aktualizacja bez restartu – podmiana przy wyjściu

async function sprawdzAktualizacje({ cicho }) {
  if (AKT.trwa || testowy) return;
  let info;
  AKT.trwa = true;
  try { info = await sprawdzWydanie(); }
  catch (e) {
    if (!cicho) okienko({ type: 'warning', message: 'Nie udało się sprawdzić aktualizacji.', detail: String((e && e.message) || e) });
    return;
  } finally { AKT.trwa = false; }
  const u = ustawienia();
  if (!info.dostepna) { if (!cicho) okienko({ type: 'info', message: `Masz najnowszą wersję (${WERSJA}).` }); return; }
  if (cicho && u.pominWersje === info.najnowsza) return;
  if (AKT.podmiana && AKT.podmiana.wersja === info.najnowsza) {
    const r = await okienko({ type: 'info', buttons: ['Uruchom ponownie', 'Później'], defaultId: 0, cancelId: 1,
      message: `Wersja ${info.najnowsza} jest pobrana.`, detail: 'Aplikacja podmieni się po zamknięciu.' });
    if (r.response === 0 && await czyMoznaPorzucic()) zrestartuj();
    return;
  }
  const opis = info.opis.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s*by @\S+ in https?:\S+/, '').trim())
    .filter((l) => l && !/^#+\s*(What's Changed|Full Changelog)|^\*\*Full Changelog/.test(l)).slice(0, 10).join('\n');
  const jak = info.rodzaj === 'kod'
    ? `Mała aktualizacja: ${MB(info.rozmiar)}. Aplikacja uruchomi się ponownie.`
    : `Pełna aktualizacja (nowa wersja silnika Electron): ${MB(info.rozmiar)}. Po pobraniu aplikacja zamknie się, podmieni i uruchomi ponownie.`;
  const r = await okienko({ type: 'info', buttons: ['Zainstaluj', 'Później', 'Pomiń tę wersję'], defaultId: 0, cancelId: 1,
    message: `Dostępna jest wersja ${info.najnowsza} (masz ${WERSJA}).`, detail: jak + (opis ? '\n\nCo nowego:\n' + opis : '') });
  if (r.response === 2) { u.pominWersje = info.najnowsza; zapiszUstawienia(u); return; }
  if (r.response !== 0) return;
  try { await zainstalujAktualizacje(info); }
  catch (e) {
    const r2 = await okienko({ type: 'error', buttons: ['Otwórz stronę wydania', 'Zamknij'], defaultId: 1, cancelId: 1,
      message: 'Aktualizacja nie powiodła się.', detail: String((e && e.message) || e) + '\n\nMożesz pobrać plik DMG ze strony wydania.' });
    if (r2.response === 0 && info.strona) shell.openExternal(info.strona);
    return;
  }
  if (await czyMoznaPorzucic()) return zrestartuj();
  okienko({ type: 'info', message: `Wersja ${info.najnowsza} uruchomi się przy następnym starcie aplikacji.` });
}

// Zlecenie z pliku .generator/zlecenia/aktualizacja: „instaluj = tak” (domyślnie tylko sprawdza),
// „restart = nie” (domyślnie po instalacji restart – chyba że edytor ma niezapisane zmiany).
// Wynik: wynik-aktualizacja.json; plik wyniku powstaje przed restartem.
const TAK = (v) => /^(tak|t|true|1|yes)$/i.test(String(v).trim());
async function zlecenieAktualizacji() {
  const folder = path.join(projekt, ...FOLDER_ZLECEN), plik = path.join(folder, 'aktualizacja');
  let tekst;
  try { if (!fs.statSync(plik).isFile()) return; tekst = fs.readFileSync(plik, 'utf8'); } catch (e) { return; }
  const wynikPlik = path.join(folder, 'wynik-aktualizacja.json');
  fs.rmSync(wynikPlik, { force: true });
  const opcje = { instaluj: false, restart: true }, ostrzezenia = [];
  for (const [k, v] of Object.entries(czytajZlecenie(tekst))) {
    const kk = k.trim().toLowerCase();
    if (kk === 'instaluj' || kk === 'restart') opcje[kk] = TAK(v); else ostrzezenia.push(`nieznany klucz „${k}” – pominięty`);
  }
  const wynik = { zlecenie: 'aktualizacja', czas: new Date().toISOString(), wersjaAplikacji: WERSJA, kod: KOD.zrodlo,
    electron: process.versions.electron, opcje, ok: false, blad: null };
  if (ostrzezenia.length) wynik.ostrzezenia = ostrzezenia;
  let restart = false;
  try {
    if (AKT.trwa) throw new Error('aktualizacja już trwa');
    const info = await sprawdzWydanie();
    Object.assign(wynik, { ok: true, najnowsza: info.najnowsza, dostepna: info.dostepna, rodzaj: info.dostepna ? info.rodzaj : null,
      rozmiar: info.dostepna ? info.rozmiar : 0, zainstalowano: false, restart: false });
    if (opcje.instaluj && info.dostepna) {
      await zainstalujAktualizacje(info);
      wynik.zainstalowano = true;
      wynik.niezapisaneZmiany = zmiany;
      restart = wynik.restart = opcje.restart && !zmiany;
      if (!restart) wynik.uwaga = info.rodzaj === 'kod' ? 'nowa wersja uruchomi się przy następnym starcie aplikacji'
        : 'aplikacja podmieni się po zamknięciu';
    }
  } catch (e) { wynik.ok = false; wynik.blad = String((e && e.message) || e); }
  try { fs.rmSync(plik, { force: true }); fs.writeFileSync(wynikPlik, JSON.stringify(wynik, null, 1)); } catch (e) { /* trudno */ }
  if (restart && !testowy) setTimeout(zrestartuj, 500);
}
// Usunięcie znacznika startu nakładki – nowy kod uruchomił się poprawnie (nakladka.js).
function potwierdzStart() {
  if (KOD.znacznik) try { fs.rmSync(KOD.znacznik, { force: true }); } catch (e) { /* trudno */ }
}

// ── Menu ────────────────────────────────────────────────────────────────────
const wStronie = (kod) => () => okno && okno.webContents.executeJavaScript(kod).catch(() => {});

function zbudujMenu() {
  const ost = ostatnie();
  const przyk = listaPrzykladow();
  // Uwaga: nie „szablon” – ta nazwa to otwarty plik szablonu (zmienna globalna).
  const menu = [
    {
      label: 'KarKa',
      submenu: [
        { role: 'about', label: 'O aplikacji KarKa' },
        { label: 'Sprawdź aktualizacje…', enabled: !AKT.trwa, click: () => sprawdzAktualizacje({ cicho: false }) },
        { type: 'separator' },
        { role: 'services', label: 'Usługi' },
        { type: 'separator' },
        { role: 'hide', label: 'Ukryj KarKę' },
        { role: 'hideOthers', label: 'Ukryj pozostałe' },
        { role: 'unhide', label: 'Pokaż wszystkie' },
        { type: 'separator' },
        { role: 'quit', label: 'Zakończ KarKę' },
      ],
    },
    {
      label: 'Plik',
      submenu: [
        { label: 'Nowy projekt…', accelerator: 'CmdOrCtrl+N', click: () => nowyProjekt() },
        { label: 'Otwórz szablon…', accelerator: 'CmdOrCtrl+O', click: () => wybierzSzablon() },
        {
          label: 'Ostatnie projekty',
          submenu: ost.length
            ? [...ost.map((p) => ({ label: `${path.basename(folderProjektu(p))} – ${path.basename(p)}`, sublabel: p, click: () => otworzSzablon(p) })),
               { type: 'separator' },
               { label: 'Wyczyść listę', click: () => { const u = ustawienia(); u.ostatnie = []; zapiszUstawienia(u); app.clearRecentDocuments(); zbudujMenu(); } }]
            : [{ label: 'Brak', enabled: false }],
        },
        {
          label: 'Przykłady',
          submenu: przyk.length ? przyk.map((n) => ({ label: n, click: () => otworzSzablon(path.join(PRZYKLADY, n)) })) : [{ label: 'Brak', enabled: false }],
        },
        { type: 'separator' },
        { label: 'Pokaż folder projektu w Finderze', enabled: !!projekt, click: () => shell.openPath(projekt) },
        { type: 'separator' },
        { label: 'Zapisz szablon', accelerator: 'CmdOrCtrl+S', enabled: !!szablon && !jestPrzykladem(szablon), click: wStronie('window.zapiszSzablon && zapiszSzablon()') },
        { label: 'Historia wersji…', enabled: !!projekt, click: wStronie('window.pokazHistorie && pokazHistorie(true)') },
        { type: 'separator' },
        { label: 'Drukuj…', accelerator: 'CmdOrCtrl+P', enabled: !!projekt, click: wStronie("window.oknoDruku && oknoDruku('drukuj')") },
        { label: 'Zapisz PDF…', accelerator: 'Shift+CmdOrCtrl+S', enabled: !!projekt, click: wStronie("window.oknoDruku && oknoDruku('pdf')") },
        {
          label: 'Eksport',
          submenu: [
            { label: 'Obrazki kart (JPG / PNG)…', accelerator: 'CmdOrCtrl+E', enabled: !!projekt, click: wStronie('window.oknoObrazkow && oknoObrazkow()') },
            { label: 'Pokój playingcards.io…', enabled: !!projekt, click: wStronie('window.oknoPcio && oknoPcio()') },
            { label: 'Katalog talii (JPG)…', enabled: !!projekt, click: wStronie('window.oknoKatalogu && oknoKatalogu()') },
          ],
        },
        { type: 'separator' },
        { role: 'close', label: 'Zamknij okno' },
      ],
    },
    { role: 'editMenu', label: 'Edycja' },
    {
      label: 'Widok',
      submenu: [
        { label: 'Edytor szablonu', accelerator: 'Alt+CmdOrCtrl+E', enabled: !!szablon, click: wStronie('window.przelaczEdytor && przelaczEdytor()') },
        { label: 'Raport projektu', enabled: !!projekt, click: wStronie('window.pokazRaport && pokazRaport(true)') },
        { type: 'separator' },
        { label: 'Odśwież karty', accelerator: 'CmdOrCtrl+R', click: wStronie('window.odswiezKarty && odswiezKarty()') },
        { label: 'Odświeżaj automatycznie', type: 'checkbox', checked: ustawienia().auto !== false, click: (mi) => {
          const u = ustawienia(); u.auto = mi.checked; zapiszUstawienia(u);
          wStronie(`window.ustawAuto && ustawAuto(${mi.checked})`)();
        } },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Rzeczywisty rozmiar' },
        { role: 'zoomIn', label: 'Powiększ' },
        { role: 'zoomOut', label: 'Pomniejsz' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pełny ekran' },
        { role: 'toggleDevTools', label: 'Narzędzia deweloperskie', accelerator: 'Alt+CmdOrCtrl+I' },
      ],
    },
    { role: 'windowMenu', label: 'Okno' },
    { role: 'help', label: 'Pomoc', submenu: [{ label: 'Dokumentacja', click: () => shell.openExternal(DOKUMENTACJA) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
}

// ── Okno ────────────────────────────────────────────────────────────────────
function utworzOkno() {
  okno = new BrowserWindow({
    width: 1400, height: 900, minWidth: 800, minHeight: 500, title: 'KarKa',
    backgroundColor: '#ece9e4', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  okno.once('ready-to-show', () => okno.show());
  okno.webContents.once('did-finish-load', potwierdzStart);
  okno.on('page-title-updated', (e) => e.preventDefault());      // tytuł okna = nazwa projektu
  okno.on('closed', () => { okno = null; });
  okno.on('close', (e) => {                                   // niezapisany szablon przy zamykaniu okna
    if (!zmiany || testowy) return;
    e.preventDefault();
    czyMoznaPorzucic().then((ok) => { if (ok && okno) okno.close(); });
  });

  const nasz = `http://127.0.0.1:${port}/`;
  okno.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(nasz)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  okno.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
}

// Biblioteki i czcionki z CDN podmieniamy na kopie w aplikacji – działa bez internetu.
function przekierujCdn() {
  const lokalnie = (p) => ({ redirectURL: `http://127.0.0.1:${port}/.app/${p}` });
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['https://cdn.jsdelivr.net/*', 'https://fonts.googleapis.com/*'] },
    (d, cb) => {
      const u = d.url;
      if (/\/html-to-image(@[^/]*)?\/dist\/html-to-image\.js/.test(u)) return cb(lokalnie('vendor/html-to-image.js'));
      if (/\/jszip(@[^/]*)?\/dist\/jszip\.min\.js/.test(u)) return cb(lokalnie('vendor/jszip.min.js'));
      if (/\/xlsx(@[^/]*)?\/dist\/xlsx\.full\.min\.js/.test(u)) return cb(lokalnie('vendor/xlsx.full.min.js'));
      if (u.startsWith('https://fonts.googleapis.com/css2') && u.includes('EB+Garamond') && u.includes('Patrick+Hand')) return cb(lokalnie('fonts/fonts.css'));
      cb({});                                               // inne czcionki Google (CZCIONKA_GOOGLE) – z internetu
    });
  // Pobrane pliki (JPG, .pcio) domyślnie do folderu projektu.
  session.defaultSession.on('will-download', (e, item) => {
    const katalog = projekt && !jestPrzykladem(projekt) ? projekt : app.getPath('downloads');
    item.setSaveDialogOptions({ defaultPath: path.join(katalog, item.getFilename()) });
  });
}

// Szerokość obrazka JPG (znacznik SOF) – do testu katalogu.
function szerokoscJpg(b) {
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xFF) return 0;
    const m = b[i + 1], dl = b.readUInt16BE(i + 2);
    if (m >= 0xC0 && m <= 0xCF && ![0xC4, 0xC8, 0xCC].includes(m)) return b.readUInt16BE(i + 7);
    i += 2 + dl;
  }
  return 0;
}
// ── Tryb testowy (CI): --test-pdf <szablon.txt|folder|-> <plik.pdf> ──────────
// Otwiera projekt, czeka na karty, zapisuje PDF i zrzut podglądu, wypisuje stan i kończy.
async function trybTestowy(folder, wynik) {
  const wc = okno.webContents;
  const czekaj = (ms) => new Promise((r) => setTimeout(r, ms));
  let stan = '';
  for (let i = 0; folder !== '-' && i < 120; i++) {
    await czekaj(500);
    stan = await wc.executeJavaScript("document.getElementById('status').textContent").catch(() => '');
    if (/ kart /.test(stan)) break;
  }
  await czekaj(1000);
  const zrzut = await okno.capturePage();
  fs.writeFileSync(wynik.replace(/\.pdf$/i, '') + '.png', zrzut.toPNG());
  if (folder === '-') {                                   // sam ekran powitalny
    process.stdout.write(JSON.stringify({ start: await wc.executeJavaScript("document.getElementById('start').innerText") }) + '\n');
    return app.exit(0);
  }
  const uwagi = await wc.executeJavaScript("document.getElementById('uwagi').innerText").catch(() => '');
  // Eksport JPG z biblioteką wbudowaną w aplikację (sprawdza podmianę CDN → zasoby).
  const jpg = await wc.executeJavaScript(`(async () => {
    await loadScript('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js');
    const b = await jpegBlob(document.querySelector('.karta:not(.rewers)'), { pixelRatio: 1, quality: 0.9 });
    return b.type + ' ' + b.size;
  })()`).catch((e) => 'błąd: ' + e.message);
  // Czcionki osadzone w obrazkach kart (bez nich JPG/PNG wychodziły czcionką zastępczą).
  const czcionki = await wc.executeJavaScript(`cssCzcionek().then((c) => ({ dlugosc: c.length, garamond: /font-family:\\s*'EB Garamond'/.test(c), patrick: /Patrick Hand/.test(c), data: (c.match(/url\\(data:/g) || []).length }))`).catch((e) => ({ blad: e.message }));
  czcionki.ok = czcionki.garamond && czcionki.patrick && czcionki.data >= 4;
  // Eksport JPG do folderu Export (tylko poza przykładami – przykłady pytają o folder).
  let eksport = '';
  if (!jestPrzykladem(szablon)) {
    wc.executeJavaScript('eksportObrazkow({})');
    for (let i = 0; i < 240 && !/^(Zapisano|Eksport obrazków nie)/.test(eksport); i++) {
      await czekaj(500);
      eksport = await wc.executeJavaScript("document.getElementById('status').textContent").catch(() => '');
    }
  }
  // Edytor (--test-edytor, tylko poza przykładami): kolorowanie, błąd w wierszu, podgląd na żywo, zapis.
  let edytor = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const oryginal = fs.readFileSync(szablon, 'utf8');
    const wpisz = (t) => js(`(() => { const p = document.getElementById('edPole'); p.value = ${JSON.stringify(t)}; p.dispatchEvent(new Event('input')); })()`);
    await js('przelaczEdytor(true)');
    const kolory = await js("document.querySelectorAll('#edKolory .sk-kmd').length");
    await wpisz(oryginal + '\nBŁĘDNA = 1\n'); await czekaj(2000);
    const bladLinia = oryginal.split('\n').length + 1;
    const blad = await js(`document.querySelector('#edNumery div:nth-child(${bladLinia})').className + ' | ' + document.getElementById('edBledy').innerText`);
    const zmianyPrzed = zmiany;
    const zmieniony = oryginal.replace(/^KARTA\s*=\s*63\s*,\s*88/m, 'KARTA = 70, 100');
    await wpisz(zmieniony); await czekaj(2000);
    const szer = await js("Math.round(document.querySelector('#podglad .karta:not(.rewers)').getBoundingClientRect().width * 25.4 / 96)");
    await js('zapiszSzablon()'); await czekaj(500);
    const zapisany = fs.readFileSync(szablon, 'utf8') === zmieniony && !zmiany;
    await wpisz(oryginal); await js('zapiszSzablon()'); await czekaj(1500);
    const przywrocony = fs.readFileSync(szablon, 'utf8') === oryginal;
    // Bez pętli odświeżania: odcisk plików nie zależy od kolejności wczytania, a po edycji napis „odświeżono” stoi.
    const odcisk = await js('(async () => { const a = await serverStamp(); serverPaths.reverse(); const b = await serverStamp(); serverPaths.reverse(); return a === b; })()');
    await czekaj(3000);
    const czas1 = await js("document.getElementById('status').textContent"); await czekaj(6000);
    const spokoj = odcisk && czas1 === await js("document.getElementById('status').textContent");
    edytor = { kolory, blad, zmianyPrzed, szer, zapisany, przywrocony, spokoj,
      ok: spokoj && kolory > 0 && /blad/.test(blad) && /nieznana komenda/.test(blad) && zmianyPrzed && (oryginal === zmieniony || szer === 70) && zapisany && przywrocony };
    await js('przelaczEdytor(true)');
    fs.writeFileSync(wynik.replace(/\.pdf$/i, '') + '-edytor.png', (await okno.capturePage()).toPNG());
  }
  // Druk wybranych kart i tryb szkicu (--test-edytor): 2 zaznaczone karty → 2 karty w wydruku, białe tło.
  let wybor = null;
  if (process.argv.includes('--test-edytor')) {
    wybor = await wc.executeJavaScript(`(() => {
      wybierzKarty(2); buildPrint({ szkic: true, karty: kartyEksportu({ ktore: 'zaznaczone' }) });
      const karty = document.querySelectorAll('#druk .karta:not(.rewers)').length;
      const tlo = getComputedStyle(document.querySelector('#druk .karta')).backgroundColor;
      const pasek = document.getElementById('wybor').hidden;
      wyczyscWybor();
      // Linie cięcia nożyczkami: przerywana ramka wokół każdej karty, bez znaczników na marginesie.
      buildPrint({ uklad: 'a4', ciecie: 'nozyczki', rewersy: false });
      const nozyczki = { linie: document.querySelectorAll('#druk .linia-ciecia').length, karty: document.querySelectorAll('#druk .karta:not(.rewers)').length,
        znaczniki: document.querySelectorAll('#druk .znacznik').length };
      buildPrint({ uklad: 'a4', ciecie: 'oba', rewersy: false });
      nozyczki.oba = document.querySelectorAll('#druk .znacznik').length > 0 && document.querySelectorAll('#druk .linia-ciecia').length === nozyczki.linie;
      return { karty, tlo, pasek, nozyczki };
    })()`);
    wybor.raport = await wc.executeJavaScript(`raportProjektu().then((h) => { const d = document.createElement('div'); d.innerHTML = h; return d.innerText; })`).catch((e) => 'BŁĄD ' + e.message);
    wybor.ok = /Talia /.test(wybor.raport) && wybor.karty === 2 && wybor.tlo === 'rgb(255, 255, 255)' && !wybor.pasek
      && wybor.nozyczki.linie === wybor.nozyczki.karty && wybor.nozyczki.znaczniki === 0 && wybor.nozyczki.oba;
  }
  // Druk tylko zmienionych (--test-edytor): zapamiętanie odcisków → 0 zmian; zmiana szablonu → zmienione wszystkie.
  let zmienione = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const oryginal = fs.readFileSync(szablon, 'utf8');
    const wpisz = (t) => js(`(() => { const p = document.getElementById('edPole'); p.value = ${JSON.stringify(t)}; p.dispatchEvent(new Event('input')); })()`);
    const liczby = () => js("({ zm: +document.getElementById('zmLiczba').textContent, nowe: +document.getElementById('noweLiczba').textContent, widoczne: !document.getElementById('zmiany').hidden })");
    await js('zapamietajDruk(visibleCards())');
    const poZapisie = await liczby();
    await js('przelaczEdytor(true)');
    // Dopisany element tylko w pierwszej talii (część wspólna dotknęłaby wszystkich) – na końcu pliku = ostatnia talia.
    await wpisz(oryginal + '\n[AWERS]\nPROSTOKĄT = 1, 1, 3, 3, kolor=#ff00ff\n'); await czekaj(3500);
    const poZmianie = await liczby();
    const porownanie = await js("pokazPorownanie(true); document.querySelectorAll('#porownanie .para').length");
    await js('pokazPorownanie(false)');
    await js("buildPrint({ karty: kartyEksportu({ ktore: 'zmienione' }) })");
    const doDruku = await js("document.querySelectorAll('#druk .karta:not(.rewers)').length");
    await wpisz(oryginal); await czekaj(3500);
    const poPowrocie = await liczby();
    await js('przelaczEdytor(true)');
    zmienione = { poZapisie, poZmianie, porownanie, doDruku, poPowrocie };
    zmienione.ok = poZapisie.widoczne && poZapisie.zm === 0 && poZapisie.nowe === 0 && poZmianie.zm > 0
      && porownanie >= Math.min(poZmianie.zm, 40) && doDruku === poZmianie.zm && poPowrocie.zm === 0;
  }
  // Historia wersji (--test-edytor): punkt „otwarcie”, kopia po zmianie z zewnątrz, podgląd i przywrócenie.
  let hist = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const oryginal = fs.readFileSync(szablon, 'utf8');
    const lista = () => js('window.generatorApp.historiaLista()');
    const przed = await lista();
    const otwarcie = przed.punkty.find((p) => p.powod === 'otwarcie');
    const kopie = (l) => l.wersje.filter((v) => szablon.endsWith(v.plik)).length;
    const kopiePrzed = kopie(przed);
    fs.writeFileSync(szablon, oryginal + '\n; zmiana z innego edytora\n'); await czekaj(4500);
    const bezKopii = kopie(await lista()) === kopiePrzed;            // zwykła zmiana pliku – bez kopii
    await js('siatkaHistorii(0)');                                     // siatka bezpieczeństwa (bez czekania godziny)
    const po = await lista();
    const kopieSzablonu = kopie(po);
    fs.writeFileSync(szablon, oryginal + '\n; druga zmiana\n'); await czekaj(2500);
    await js('siatkaHistorii()');                                      // ostatnia kopia sprzed chwili – bez nowej
    const siatkaOdstep = kopie(await lista()) === kopieSzablonu;
    await js('pokazHistorie(true)');
    const wiersze = await js("document.querySelectorAll('#historia .wiersz').length");
    const diff = await js(`(async () => { const b = document.querySelector('#historia .wiersz:last-child [data-akcja="zmiany"]'); const sz = b.closest('.wiersz').querySelector('.szczegoly'); await akcjaHistorii(b, +b.closest('.wiersz').dataset.czas); return sz.innerText; })()`);
    fs.writeFileSync(wynik.replace(/\.pdf$/i, '') + '-historia.png', (await okno.capturePage()).toPNG());
    await js(`podgladWersji(${otwarcie ? otwarcie.czas : 0})`);
    const baner = await js("!document.getElementById('wersjaBaner').hidden && / kart /.test(document.getElementById('status').textContent)");
    await js(`przywrocWersje(${otwarcie ? otwarcie.czas : 0})`); await czekaj(3500);
    const przywrocony = fs.readFileSync(szablon, 'utf8') === oryginal;
    // Skrzynka: punkt z opisem od zewnętrznego narzędzia trafia do historii sam.
    const skr = path.join(projekt, historia.FOLDER, historia.SKRZYNKA, 'test');
    const rel = path.relative(projekt, szablon);
    fs.mkdirSync(path.dirname(path.join(skr, rel)), { recursive: true });
    fs.writeFileSync(path.join(skr, rel), oryginal + '\n; ze skrzynki\n');
    fs.writeFileSync(path.join(skr, 'opis.txt'), 'Claude: test skrzynki');
    await czekaj(4000);
    const zeSkrzynki = (await lista()).punkty.some((p) => p.etykieta === 'Claude: test skrzynki') && !fs.existsSync(skr);
    const punkty = (await lista()).punkty.map((p) => p.powod);
    await js('pokazHistorie(false)');
    hist = { otwarcie: !!otwarcie, bezKopii, siatkaOdstep, kopieSzablonu, wiersze, diff: diff.slice(0, 120), baner, przywrocony, punkty, zeSkrzynki };
    hist.ok = !!otwarcie && bezKopii && siatkaOdstep && kopieSzablonu === kopiePrzed + 1 && po.punkty.some((p) => p.powod === 'siatka' && p.etykieta === 'Siatka bezpieczeństwa')
      && po.punkty.some((p) => p.powod === 'eksport') && wiersze >= 2 && /druga zmiana/.test(diff) && baner && przywrocony
      && punkty.includes('przed przywróceniem') && zeSkrzynki;
  }
  // Eksport playingcards.io (poza przykładami): nowy pokój – stos na talię, wszystkie karty.
  let pcio = null;
  if (!jestPrzykladem(szablon)) {
    pcio = await wc.executeJavaScript(`exportPcio().then((r) => ({ ...r, talieWidok: document.querySelectorAll('#podglad .talia').length,
      kartyWidok: document.querySelectorAll('#podglad .karta:not(.rewers)').length }), (e) => ({ blad: String((e && (e.message || e.type)) || e) }))`);
    const zip = pcio && pcio.plik && fs.existsSync(pcio.plik) ? fs.readFileSync(pcio.plik) : null;
    pcio.ok = !!zip && zip.slice(0, 2).toString() === 'PK' && pcio.holdery === pcio.talieWidok && pcio.karty === pcio.kartyWidok;
  }
  // Okna eksportu (--test-edytor, poza przykładami): PNG 300 dpi przez okno, zapamiętane ustawienia, okno druku.
  let okna = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const exportDir = path.join(projekt, 'Export');
    const przed = new Set(fs.existsSync(exportDir) ? fs.readdirSync(exportDir) : []);
    await js(`(async () => { const p = oknoObrazkow(); const f = document.getElementById('oknoForm');
      f.querySelector('[name=format][value=png]').checked = true; f.querySelector('[name=dpi][value="300"]').checked = true;
      f.querySelector('[name=rewersy]').checked = false; document.querySelector('#oknoPrzyciski .domyslny').click(); await p; })()`);
    const png = fs.readdirSync(exportDir).filter((n) => n.endsWith('.png') && !przed.has(n));
    const szer = png.length ? fs.readFileSync(path.join(exportDir, png[0])).readUInt32BE(16) : 0;
    // Oczekiwana szerokość: najwęższa karta przy 300 dpi (karta 63 mm ≈ 744 px, mini 44 mm ≈ 520 px).
    const szerMin = Math.floor(await js("(() => { return Math.min(...kartyEksportu({}).map((k) => cardMm(k)[0])) / 25.4 * 300 * 0.97; })()"));
    const zapamietane = await js(`(async () => { const p = otworzOkno('obrazki'); const f = document.getElementById('oknoForm');
      const r = { format: f.querySelector('[name=format]:checked').value, dpi: f.querySelector('[name=dpi]:checked').value, rewersy: f.querySelector('[name=rewersy]').checked };
      document.querySelector('#oknoPrzyciski button').click(); await p; return r; })()`);
    const plik = await js('window.generatorApp.eksportUstawienia()');
    const druk = await js(`(() => { window.__okno = otworzOkno('druk', 'drukuj'); const f = document.getElementById('oknoForm');
      return { pola: ['uklad', 'rewersy', 'szkic', 'ktore'].filter((n) => f.querySelector('[name=' + n + ']')).length, domyslny: document.querySelector('#oknoPrzyciski .domyslny').textContent }; })()`);
    await czekaj(300);
    fs.writeFileSync(wynik.replace(/\.pdf$/i, '') + '-okno.png', (await okno.capturePage()).toPNG());
    await js("document.getElementById('okno').dispatchEvent(new Event('cancel')); window.__okno");
    const kartyWidok = await js("document.querySelectorAll('#podglad .karta:not(.rewers)').length");
    okna = { png: png.length, kartyWidok, szer, zapamietane, plik: plik && plik.obrazki, druk };
    okna.ok = png.length === kartyWidok && szer >= szerMin && zapamietane.format === 'png' && zapamietane.dpi === '300' && !zapamietane.rewersy
      && plik && plik.obrazki && plik.obrazki.format === 'png' && druk.pola === 4 && druk.domyslny === 'Drukuj…';
  }
  // Drukarnia (--test-edytor): strona na kopię (awers, rewers…), strona = karta + 2 × spad.
  let drukarnia = null;
  if (process.argv.includes('--test-edytor')) {
    drukarnia = await wc.executeJavaScript(`(() => {
      const karty = kartyEksportu({});
      const rewersy = karty.filter((k) => backOf(k.dataset.talia)).length;
      buildPrint({ uklad: 'drukarnia', spad: 2, karty });
      const strony = document.querySelectorAll('#druk .arkusz');
      const [w, h] = cardMm(karty[0]);
      return { strony: strony.length, oczekiwane: karty.length + rewersy, rozmiar: strony[0].style.width + ' ' + strony[0].style.height,
        karta: Math.min(w, h) + 4 + 'mm ' + (Math.max(w, h) + 4) + 'mm', znaczniki: document.querySelectorAll('#druk .znacznik').length,
        raport: /Obrazki poniżej 300 dpi/.test(document.getElementById('raport').innerHTML) };
    })()`);
    drukarnia.raport = /Obrazki poniżej 300 dpi/.test(await wc.executeJavaScript('raportProjektu()'));
    drukarnia.ok = drukarnia.strony === drukarnia.oczekiwane && drukarnia.rozmiar === drukarnia.karta && drukarnia.znaczniki === 0 && drukarnia.raport;
  }
  // Katalog (--test-edytor, poza przykładami): A – Export/katalog; B – zlecenie z pliku → wynik.json.
  let katalog = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const a = await js("zapiszKatalog({}, 'katalog')");
    const kat = path.join(projekt, 'Export', 'katalog');
    const pngA = a && a.pliki ? a.pliki.filter((n) => fs.existsSync(path.join(kat, n))) : [];
    const szer = pngA.length ? szerokoscJpg(fs.readFileSync(path.join(kat, pngA[0]))) : 0;
    const talia = a && a.talie && a.talie[0] ? a.talie[0].nazwa : '';
    const zl = path.join(projekt, ...FOLDER_ZLECEN);
    fs.mkdirSync(zl, { recursive: true });
    fs.writeFileSync(path.join(zl, 'katalog'), `talie = ${talia}\n`);
    let w = null;
    for (let i = 0; i < 60 && !w; i++) { await czekaj(500); try { w = JSON.parse(fs.readFileSync(path.join(zl, 'wynik.json'), 'utf8')); } catch (e) { /* jeszcze nie */ } }
    const pngB = w && w.pliki ? w.pliki.filter((n) => fs.existsSync(path.join(projekt, '.generator', 'katalog', n))).length : 0;
    katalog = { a: pngA.length, szer, talia, b: w && { ok: w.ok, pliki: w.pliki, talie: (w.talie || []).map((t) => t.nazwa), uwagi: w.uwagi }, pngB,
      zlecenieUsuniete: !fs.existsSync(path.join(zl, 'katalog')) };
    katalog.ok = pngA.length > 0 && szer > 300 && szer <= 2000 && !!w && w.ok && pngB === w.pliki.length && pngB > 0
      && katalog.b.talie.length === 1 && katalog.b.talie[0] === talia && katalog.zlecenieUsuniete;
  }
  // Zlecenia z pliku dla całej gry (--test-edytor, poza przykładami): stan, raport, pdf, obrazki, pcio,
  // dwa zlecenia naraz, błędne opcje, „tylko zmienione”, niezapisany edytor (karty z dysku), ustawienia okien bez zmian.
  let zlecenia = null;
  if (process.argv.includes('--test-edytor') && !jestPrzykladem(szablon)) {
    const js = (k) => wc.executeJavaScript(k);
    const zl = path.join(projekt, ...FOLDER_ZLECEN);
    fs.mkdirSync(zl, { recursive: true });
    const czytaj = (p) => { try { return JSON.parse(fs.readFileSync(path.join(zl, `wynik-${p}.json`), 'utf8')); } catch (e) { return null; } };
    const czekajNa = async (pol) => { let w = null; for (let i = 0; i < 240 && !w; i++) { await czekaj(500); w = czytaj(pol); } return w; };
    const zlec = async (pol, tresc = '') => { fs.rmSync(path.join(zl, `wynik-${pol}.json`), { force: true }); fs.writeFileSync(path.join(zl, pol), tresc); return czekajNa(pol); };
    const ustPrzed = JSON.stringify(await js('USTAWIENIA_OKIEN'));
    const pierwsza = await js("(() => { const k = document.querySelector('#podglad .karta:not(.rewers)'); return { talia: k.dataset.talia, id: k.dataset.id }; })()");
    const z = { talia: pierwsza.talia };
    // Dwa naraz: stan i raport.
    fs.writeFileSync(path.join(zl, 'raport'), '');
    const stan = await zlec('stan', '# komentarz\n');
    const raport = await czekajNa('raport');
    z.stan = stan && { ok: stan.ok, karty: stan.karty, talie: (stan.talie || []).length, wersja: stan.wersjaAplikacji, ostatniPdf: stan.ostatniPdf };
    z.raport = raport && { ok: raport.ok, sekcje: (raport.raport || []).length, pierwsza: raport.raport && raport.raport[0] && raport.raport[0].tytul };
    // PDF jednej talii bez rewersów do wskazanego pliku; potem „tylko zmienione” = brak kart.
    const pdf = await zlec('pdf', `uklad = a4\nrewersy = nie\ntalia = ${pierwsza.talia}\nplik = Export/zlecenie.pdf\nkolor = czerwony\n`);
    const pdfPlik = path.join(projekt, 'Export', 'zlecenie.pdf');
    z.pdf = pdf && { ok: pdf.ok, pliki: pdf.pliki, strony: pdf.strony, rozmiar: fs.existsSync(pdfPlik) ? fs.statSync(pdfPlik).size : 0, ostrzezenia: pdf.ostrzezenia };
    const pdfZm = await zlec('pdf', 'tylkoZmienione = tak\n');
    z.pdfZmienione = pdfZm && { ok: pdfZm.ok, blad: pdfZm.blad };
    const zle = await zlec('pdf', 'uklad = plakat\ntalie = Nie ma takiej\n');
    z.bledne = zle && { ok: zle.ok, blad: zle.blad };
    const stan2 = await zlec('stan');
    z.stanPoPdf = stan2 && { ostatniPdf: !!stan2.ostatniPdf, zmienione: stan2.zmienione };
    // Obrazki: jedna karta (wszystkie kopie) PNG bez rewersu.
    const obr = await zlec('obrazki', `format = png\ndpi = 150\ntalie = ${pierwsza.talia}\nid = ${pierwsza.id}, nie-ma-takiej\nrewersy = nie\n`);
    z.obrazki = obr && { ok: obr.ok, pliki: obr.pliki, sa: (obr.pliki || []).every((p) => fs.existsSync(path.join(projekt, p))), ostrzezenia: obr.ostrzezenia };
    // playingcards.io jednej talii.
    const pcio = await zlec('pcio', `talie = ${pierwsza.talia}\n`);
    z.pcio = pcio && { ok: pcio.ok, pliki: pcio.pliki, sa: (pcio.pliki || []).every((p) => fs.existsSync(path.join(projekt, p))), karty: pcio.karty };
    // Niezapisany edytor: zmiana tytułu kart w edytorze; zlecenie widzi wersję z dysku, edytor zostaje bez zmian.
    const nazwaKarty = await js("document.querySelector('#podglad .karta:not(.rewers)').title");
    await js("(() => { const p = document.getElementById('edPole'); p.value = p.value.replace(/^PROJEKT(\\s*)=(\\s*)/m, 'PROJEKT$1=$2ZMIANA ') + '\\n; zmiana z testu\\n'; p.dispatchEvent(new Event('input')); })()");
    await czekaj(1500);
    const projektEd = await js('PROJEKT');
    const stanEd = await zlec('stan');
    await czekaj(1500);
    const poEd = await js("({ zmiany: ED.zmiany, tekst: edytorTekst().includes('zmiana z testu') })");
    z.edytor = stanEd && { niezapisane: stanEd.niezapisaneZmiany, projekt: stanEd.projekt, projektEd, poZleceniu: { ...poEd, projekt: await js('PROJEKT') } };
    await js("(() => { const p = document.getElementById('edPole'); p.value = ED.dysk; p.dispatchEvent(new Event('input')); })()");
    await czekaj(1500);
    z.ustawieniaBezZmian = JSON.stringify(await js('USTAWIENIA_OKIEN')) === ustPrzed;
    z.pozostale = fs.readdirSync(zl).filter((n) => POLECENIA.includes(n));
    z.ok = !!(z.stan && z.stan.ok && z.stan.karty > 0 && z.stan.talie > 0 && z.stan.wersja
      && z.raport && z.raport.ok && z.raport.sekcje > 0
      && z.pdf && z.pdf.ok && z.pdf.rozmiar > 1000 && z.pdf.pliki[0] === path.join('Export', 'zlecenie.pdf') && z.pdf.strony >= 1
      && (z.pdf.ostrzezenia || []).some((x) => x.includes('kolor'))
      && z.pdfZmienione && !z.pdfZmienione.ok && /zmienionych/.test(z.pdfZmienione.blad)
      && z.bledne && !z.bledne.ok && /uklad/.test(z.bledne.blad) && /Nie ma takiej/.test(z.bledne.blad)
      && z.stanPoPdf && z.stanPoPdf.ostatniPdf && Array.isArray(z.stanPoPdf.zmienione)
      && z.obrazki && z.obrazki.ok && z.obrazki.pliki.length >= 1 && z.obrazki.sa && z.obrazki.pliki.every((p) => /\.png$/.test(p))
      && (z.obrazki.ostrzezenia || []).some((x) => x.includes('nie-ma-takiej'))
      && z.pcio && z.pcio.ok && z.pcio.sa && z.pcio.karty > 0
      && z.edytor && z.edytor.niezapisane && !/ZMIANA/.test(z.edytor.projekt) && /ZMIANA/.test(z.edytor.projektEd) && /ZMIANA/.test(z.edytor.poZleceniu.projekt) && z.edytor.poZleceniu.zmiany && z.edytor.poZleceniu.tekst
      && z.ustawieniaBezZmian && !z.pozostale.length);
    z.nazwaKarty = nazwaKarty;
    zlecenia = z;
  }
  // Aktualizacja zleceniem z pliku (--test-aktualizacja, serwer testowy w KARKA_AKTUALIZACJE;
  // scripts/test-aktualizacje.js --electron): samo sprawdzenie, potem instalacja nakładki (bez restartu w teście).
  let aktualizacja = null;
  if (process.argv.includes('--test-aktualizacja') && !jestPrzykladem(szablon)) {
    const zl = path.join(projekt, ...FOLDER_ZLECEN), wp = path.join(zl, 'wynik-aktualizacja.json');
    fs.mkdirSync(zl, { recursive: true });
    const zlec = async (tresc) => {
      fs.rmSync(wp, { force: true }); fs.writeFileSync(path.join(zl, 'aktualizacja'), tresc);
      for (let i = 0; i < 120; i++) { await czekaj(500); try { return JSON.parse(fs.readFileSync(wp, 'utf8')); } catch (e) { /* jeszcze nie */ } }
      return null;
    };
    const spr = await zlec('');
    const inst = await zlec('instaluj = tak\nnieznany = 1\n');
    aktualizacja = { sprawdzenie: spr && { ok: spr.ok, dostepna: spr.dostepna, rodzaj: spr.rodzaj, zainstalowano: spr.zainstalowano, blad: spr.blad },
      instalacja: inst && { ok: inst.ok, zainstalowano: inst.zainstalowano, restart: inst.restart, ostrzezenia: inst.ostrzezenia, blad: inst.blad } };
    aktualizacja.ok = !!(spr && spr.ok && spr.dostepna && spr.rodzaj === 'kod' && !spr.zainstalowano
      && inst && inst.ok && inst.zainstalowano && inst.restart && (inst.ostrzezenia || []).length === 1
      && fs.existsSync(path.join(app.getPath('userData'), 'kod', 'main.js')));
  }
  await wc.executeJavaScript('buildPrint()');
  await pdfDoPliku(wc, wynik);
  // Menu aplikacji: własne (polskie), a nie domyślne Electrona.
  const menu = (Menu.getApplicationMenu()?.items || []).map((i) => i.label);
  const plik = Menu.getApplicationMenu()?.items.find((i) => i.label === 'Plik');
  const menuOk = menu.includes('Plik') && menu.includes('Widok') && !!plik && plik.submenu.items.some((i) => i.label === 'Zapisz szablon')
    && Menu.getApplicationMenu().items[0].submenu.items.some((i) => i.label === 'Sprawdź aktualizacje…');
  const ok = menuOk && czcionki.ok && / kart /.test(stan) && !uwagi.trim() && /^image\/jpeg [1-9]/.test(jpg) && (!eksport || eksport.startsWith('Zapisano'))
    && (!edytor || edytor.ok) && (!wybor || wybor.ok) && (!zmienione || zmienione.ok) && (!hist || hist.ok) && (!pcio || pcio.ok) && (!okna || okna.ok)
    && (!drukarnia || drukarnia.ok) && (!katalog || katalog.ok) && (!zlecenia || zlecenia.ok) && (!aktualizacja || aktualizacja.ok);
  process.stdout.write(JSON.stringify({ szablon, stan, uwagi, czcionki, jpg, eksport, edytor, wybor, zmienione, hist, pcio, okna, drukarnia, katalog, zlecenia, aktualizacja, menu, kod: { zrodlo: KOD.zrodlo, wersja: WERSJA, powod: KOD.powod || null }, pdf: wynik, ok }) + '\n');
  app.exit(ok ? 0 : 1);
}

// ── Start ───────────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (okno) { if (okno.isMinimized()) okno.restore(); okno.focus(); } });

let doOtwarcia = null;                                   // szablon otwarty z Findera przed startem aplikacji
app.on('open-file', (e, p) => {
  e.preventDefault();
  if (app.isReady() && okno) otworzSzablon(p); else doOtwarcia = p;
});

app.whenReady().then(async () => {
  const serwer = utworzSerwer({ zasoby: ZASOBY, projekt: () => projekt });
  await new Promise((ok) => serwer.listen(0, '127.0.0.1', ok));
  port = serwer.address().port;
  przekierujCdn();
  let nazwaWydania = '';
  try { nazwaWydania = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8')).nazwaWydania || ''; } catch (e) { /* bez nazwy */ }
  app.setAboutPanelOptions({ applicationName: 'KarKa', credits: 'Kawia Karciana – generator kart do gier (dawniej Generator kart)', applicationVersion: WERSJA + (nazwaWydania ? ` „${nazwaWydania}”` : ''),
    version: `${KOD.zrodlo === 'nakładka' ? 'kod z aktualizacji, ' : ''}Electron ${process.versions.electron}` });
  utworzOkno();

  const argi = process.argv;
  const t = argi.indexOf('--test-pdf');
  const tn = argi.indexOf('--test-nowy');                 // --test-nowy <nowy folder gry> --test-pdf - <wynik.pdf>
  if (t >= 0) {
    testowy = true;
    if (tn >= 0) otworzSzablon(utworzProjekt(path.resolve(argi[tn + 1])));
    else otworzSzablon(argi[t + 1] === '-' ? null : path.resolve(argi[t + 1]));
    okno.webContents.once('did-finish-load', () => trybTestowy(tn >= 0 ? argi[tn + 1] : argi[t + 1], path.resolve(argi[t + 2])));
    return;
  }
  otworzSzablon(doOtwarcia || ostatnie()[0] || null);
  setTimeout(() => sprawdzAktualizacje({ cicho: true }), 4000);
});

app.on('activate', () => { if (!okno && port) { utworzOkno(); otworzSzablon(szablon); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => historiaZamkniecie());
app.on('before-quit', (e) => {                               // ⌘Q z niezapisanym szablonem
  if (!zmiany || testowy) return;
  e.preventDefault();
  czyMoznaPorzucic().then((ok) => { if (ok) app.quit(); });
});
