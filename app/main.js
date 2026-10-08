'use strict';
// Generator kart – aplikacja na macOS (Electron).
// Okno pokazuje generator (generator/karty.html). Pliki projektu podaje lokalny serwer (serwer.js),
// a biblioteki i czcionki są w aplikacji. Projekt otwiera się przez wskazanie pliku szablonu.
const { app, BrowserWindow, Menu, dialog, ipcMain, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { utworzSerwer } = require('./serwer');

const ZASOBY = app.isPackaged ? path.join(process.resourcesPath, 'zasoby') : path.join(__dirname, 'zasoby');
const PRZYKLADY = path.join(ZASOBY, 'przyklady');
const DOKUMENTACJA = 'https://github.com/DarkenPL/GeneratorKart#readme';

let okno = null;
let szablon = null;          // otwarty plik szablonu (.txt)
let projekt = null;          // folder projektu: folder szablonu, a gdy szablon leży w „Szablony” – folder nad nim
let port = 0;
let testowy = false;         // tryb testowy (CI) – bez otwierania okien Findera

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
function otworzSzablon(plik) {
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
  szablon, sciezka: projekt, nazwa: nazwaProjektu(), przyklad: jestPrzykladem(szablon),
}));
ipcMain.handle('projekt:otworz', () => wybierzSzablon());
ipcMain.handle('projekt:przyklady', () => listaPrzykladow());
ipcMain.handle('projekt:przyklad', (e, nazwa) => {
  const p = path.join(PRZYKLADY, path.basename(String(nazwa)));
  if (jestFolderem(p)) otworzSzablon(p);
});
ipcMain.handle('projekt:pokaz', () => { if (projekt) shell.openPath(projekt); });

// ── Eksport JPG do folderu Export ───────────────────────────────────────────
// Przykłady są tylko do odczytu – wtedy pytamy, gdzie zapisać.
let folderEksportu = null;
ipcMain.handle('eksport:start', async () => {
  if (projekt && !jestPrzykladem(projekt)) folderEksportu = path.join(projekt, 'Export');
  else {
    const r = await dialog.showOpenDialog(okno, {
      title: 'Gdzie zapisać obrazki?', buttonLabel: 'Wybierz', properties: ['openDirectory', 'createDirectory'],
      defaultPath: app.getPath('documents'),
    });
    if (r.canceled || !r.filePaths[0]) return null;
    folderEksportu = path.join(r.filePaths[0], 'Export');
  }
  fs.mkdirSync(folderEksportu, { recursive: true });
  return folderEksportu;
});
ipcMain.handle('eksport:plik', (e, nazwa, dane) => {
  if (!folderEksportu) throw new Error('Eksport nie został rozpoczęty');
  fs.writeFileSync(path.join(folderEksportu, path.basename(String(nazwa))), Buffer.from(dane));
});
ipcMain.handle('eksport:koniec', () => { if (folderEksportu && !testowy) shell.openPath(folderEksportu); });
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

// ── Menu ────────────────────────────────────────────────────────────────────
const wStronie = (kod) => () => okno && okno.webContents.executeJavaScript(kod).catch(() => {});

function zbudujMenu() {
  const ost = ostatnie();
  const przyk = listaPrzykladow();
  const szablon = [
    { role: 'appMenu', label: 'Generator kart' },
    {
      label: 'Plik',
      submenu: [
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
        { label: 'Zapisz PDF…', accelerator: 'CmdOrCtrl+S', enabled: !!projekt, click: wStronie('window.zapiszPdf && zapiszPdf()') },
        { label: 'Drukuj…', accelerator: 'CmdOrCtrl+P', enabled: !!projekt, click: wStronie("document.getElementById('drukuj').click()") },
        { label: 'Eksport JPG do folderu Export', accelerator: 'CmdOrCtrl+E', enabled: !!projekt, click: wStronie("document.getElementById('png').click()") },
        { label: 'Eksport do playingcards.io…', enabled: !!projekt, click: wStronie("document.getElementById('pcio').click()") },
        { type: 'separator' },
        { role: 'close', label: 'Zamknij okno' },
      ],
    },
    { role: 'editMenu', label: 'Edycja' },
    {
      label: 'Widok',
      submenu: [
        { label: 'Odśwież karty', accelerator: 'CmdOrCtrl+R', click: wStronie("document.getElementById('odswiez').click()") },
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
  Menu.setApplicationMenu(Menu.buildFromTemplate(szablon));
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
    await wc.executeJavaScript("document.getElementById('png').click()");
    for (let i = 0; i < 240 && !/^(Zapisano|Eksport JPG nie)/.test(eksport); i++) {
      await czekaj(500);
      eksport = await wc.executeJavaScript("document.getElementById('status').textContent").catch(() => '');
    }
  }
  await wc.executeJavaScript('buildPrint()');
  await pdfDoPliku(wc, wynik);
  const ok = / kart /.test(stan) && !uwagi.trim() && /^image\/jpeg [1-9]/.test(jpg) && (!eksport || eksport.startsWith('Zapisano'));
  process.stdout.write(JSON.stringify({ szablon, stan, uwagi, jpg, eksport, pdf: wynik, ok }) + '\n');
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
  if (t >= 0) {
    testowy = true;
    otworzSzablon(argi[t + 1] === '-' ? null : path.resolve(argi[t + 1]));
    okno.webContents.once('did-finish-load', () => trybTestowy(argi[t + 1], path.resolve(argi[t + 2])));
    return;
  }
  otworzSzablon(doOtwarcia || ostatnie()[0] || null);
});

app.on('activate', () => { if (!okno && port) { utworzOkno(); otworzSzablon(szablon); } });
app.on('window-all-closed', () => app.quit());
