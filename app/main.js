'use strict';
// Generator kart – aplikacja na macOS (Electron).
// Okno pokazuje generator (generator/karty.html). Pliki projektu podaje lokalny serwer (serwer.js),
// a biblioteki i czcionki są w aplikacji. Projekt otwiera się przez wskazanie pliku szablonu.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { utworzSerwer } = require('./serwer');
const historia = require('./historia');

const ZASOBY = app.isPackaged ? path.join(process.resourcesPath, 'zasoby') : path.join(__dirname, 'zasoby');
const PRZYKLADY = path.join(ZASOBY, 'przyklady');
const DOKUMENTACJA = 'https://github.com/DarkenPL/GeneratorKart#readme';

let okno = null;
let szablon = null;          // otwarty plik szablonu (.txt)
let projekt = null;          // folder projektu: folder szablonu, a gdy szablon leży w „Szablony” – folder nad nim
let port = 0;
let testowy = false;         // tryb testowy (CI) – bez otwierania okien Findera
let zmiany = false;          // niezapisane zmiany w edytorze szablonu

// ── Ustawienia: ostatnie projekty ──────────────────────────────────────────
const plikUstawien = () => path.join(app.getPath('userData'), 'ustawienia.json');
function ustawienia() {
  try { return JSON.parse(fs.readFileSync(plikUstawien(), 'utf8')); } catch (e) { return { ostatnie: [] }; }
}
function zapiszUstawienia(u) {
  try { fs.mkdirSync(path.dirname(plikUstawien()), { recursive: true }); fs.writeFileSync(plikUstawien(), JSON.stringify(u, null, 2)); }
  catch (e) { /* bez zapisu ustawień aplikacja nadal działa */ }
}
const jestPrzykladem = (p) => !!p && path.resolve(p).startsWith(path.resolve(PRZYKLADY) + path.sep);
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
    okno.setTitle(szablon ? `${nazwaProjektu()} – ${path.basename(szablon)} – Generator kart` : 'Generator kart');
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
// Zlecenia z rozmowy (np. od Claude): plik .generator/zlecenia/katalog w folderze projektu.
// Treść (opcjonalnie): wiersze „talie = A, B” i „id = 1, 7”. Otwarta aplikacja robi katalog PNG
// do .generator/katalog/, zapisuje wynik.json (pliki, Uwagi, karty za długie) i usuwa zlecenie.
const FOLDER_ZLECEN = ['.generator', 'zlecenia'];
let zlecenieTrwa = false;
function czytajZlecenie(tekst) {
  const o = {};
  for (const w of String(tekst).split(/\r?\n/)) {
    const m = /^\s*(talie|talia|id)\s*[=:]\s*(.*)$/i.exec(w);
    if (!m) continue;
    const lista = m[2].split(',').map((x) => x.trim()).filter(Boolean);
    if (/^id$/i.test(m[1])) o.id = lista; else o.talie = lista;
  }
  return o;
}
async function sprawdzZlecenia() {
  if (zlecenieTrwa || !historiaDostepna() || !okno) return;
  const plik = path.join(projekt, ...FOLDER_ZLECEN, 'katalog');
  let tekst;
  try { if (!fs.statSync(plik).isFile()) return; tekst = fs.readFileSync(plik, 'utf8'); } catch (e) { return; }
  zlecenieTrwa = true;
  const wynikPlik = path.join(projekt, ...FOLDER_ZLECEN, 'wynik.json');
  try {
    fs.rmSync(wynikPlik, { force: true });
    const opcje = czytajZlecenie(tekst);
    const w = await okno.webContents.executeJavaScript(`window.zlecenieKatalogu ? zlecenieKatalogu(${JSON.stringify(opcje)}) : { ok: false, blad: 'strona nie jest gotowa' }`);
    const wynik = { zlecenie: 'katalog', opcje, czas: new Date().toISOString(), szablon: szablon && path.relative(projekt, szablon), ...w };
    if (wynik.folder) wynik.folder = path.relative(projekt, wynik.folder);
    fs.rmSync(plik, { force: true });                     // najpierw zlecenie – wynik.json = koniec pracy
    fs.writeFileSync(wynikPlik, JSON.stringify(wynik, null, 1));
  } catch (e) {
    try { fs.rmSync(plik, { force: true }); fs.writeFileSync(wynikPlik, JSON.stringify({ zlecenie: 'katalog', ok: false, blad: String(e.message || e) }, null, 1)); } catch (e2) { /* trudno */ }
  } finally { zlecenieTrwa = false; }
}
setInterval(sprawdzZlecenia, 3000);
ipcMain.handle('historia:przywroc', (e, czas) => {
  if (!historiaDostepna()) return { blad: 'Przykłady nie mają historii.' };
  if (zmiany) return { blad: 'Najpierw zapisz albo cofnij zmiany w edytorze szablonu.' };
  return { zmienione: historia.przywroc(projekt, Number(czas)) };
});

// ── Menu ────────────────────────────────────────────────────────────────────
const wStronie = (kod) => () => okno && okno.webContents.executeJavaScript(kod).catch(() => {});

function zbudujMenu() {
  const ost = ostatnie();
  const przyk = listaPrzykladow();
  // Uwaga: nie „szablon” – ta nazwa to otwarty plik szablonu (zmienna globalna).
  const menu = [
    { role: 'appMenu', label: 'Generator kart' },
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
            { label: 'Katalog talii (PNG)…', enabled: !!projekt, click: wStronie('window.oknoKatalogu && oknoKatalogu()') },
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
    width: 1400, height: 900, minWidth: 800, minHeight: 500, title: 'Generator kart',
    backgroundColor: '#ece9e4', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  okno.once('ready-to-show', () => okno.show());
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
    okna.ok = png.length === kartyWidok && szer >= 700 && zapamietane.format === 'png' && zapamietane.dpi === '300' && !zapamietane.rewersy
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
    const szer = pngA.length ? fs.readFileSync(path.join(kat, pngA[0])).readUInt32BE(16) : 0;
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
  await wc.executeJavaScript('buildPrint()');
  await pdfDoPliku(wc, wynik);
  // Menu aplikacji: własne (polskie), a nie domyślne Electrona.
  const menu = (Menu.getApplicationMenu()?.items || []).map((i) => i.label);
  const plik = Menu.getApplicationMenu()?.items.find((i) => i.label === 'Plik');
  const menuOk = menu.includes('Plik') && menu.includes('Widok') && !!plik && plik.submenu.items.some((i) => i.label === 'Zapisz szablon');
  const ok = menuOk && / kart /.test(stan) && !uwagi.trim() && /^image\/jpeg [1-9]/.test(jpg) && (!eksport || eksport.startsWith('Zapisano'))
    && (!edytor || edytor.ok) && (!wybor || wybor.ok) && (!zmienione || zmienione.ok) && (!hist || hist.ok) && (!pcio || pcio.ok) && (!okna || okna.ok)
    && (!drukarnia || drukarnia.ok) && (!katalog || katalog.ok);
  process.stdout.write(JSON.stringify({ szablon, stan, uwagi, jpg, eksport, edytor, wybor, zmienione, hist, pcio, okna, drukarnia, katalog, menu, pdf: wynik, ok }) + '\n');
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
});

app.on('activate', () => { if (!okno && port) { utworzOkno(); otworzSzablon(szablon); } });
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => historiaZamkniecie());
app.on('before-quit', (e) => {                               // ⌘Q z niezapisanym szablonem
  if (!zmiany || testowy) return;
  e.preventDefault();
  czyMoznaPorzucic().then((ok) => { if (ok) app.quit(); });
});
