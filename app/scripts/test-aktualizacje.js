'use strict';
// Test aktualizacji (aktualizacje.js, nakladka.js, paczka-kodu.js) z lokalnym serwerem udającym GitHuba.
//   node scripts/test-aktualizacje.js              – moduły (Linux i macOS, bez Electrona)
//   node scripts/test-aktualizacje.js --electron   – też aplikacja: nakładka przy starcie i zlecenie
//                                                   „aktualizacja” (Linux z Xvfb, wymaga npm run zasoby)
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const assert = require('assert');
const { spawnSync, spawn } = require('child_process');
const akt = require('../aktualizacje');
const { wybierzNakladke, porownajWersje } = require('../nakladka');

const APP = path.join(__dirname, '..');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'gk-akt-'));
const SRV = path.join(T, 'wydanie');
const ELECTRON = require(path.join(APP, 'node_modules', 'electron', 'package.json')).version;
const WBUDOWANA = require(path.join(APP, 'package.json')).version;
const NOWA = '9.9.9';
const wyniki = [];
const ok = (nazwa, warunek, info = '') => { wyniki.push(`${warunek ? 'ok ' : 'BŁĄD'} ${nazwa}${info ? ' – ' + info : ''}`); if (!warunek) process.exitCode = 1; };

// Wydanie: pełna paczka z udawaną .app, kod.zip z wersją 9.9.9, manifest.
fs.mkdirSync(path.join(T, 'pelna', 'Generator kart.app', 'Contents'), { recursive: true });
fs.writeFileSync(path.join(T, 'pelna', 'Generator kart.app', 'Contents', 'nowa.txt'), NOWA);
fs.mkdirSync(SRV, { recursive: true });
assert.strictEqual(spawnSync('zip', ['-qr', path.join(SRV, 'Generator-kart.zip'), 'Generator kart.app'], { cwd: path.join(T, 'pelna') }).status, 0);
const pk = spawnSync(process.execPath, [path.join(__dirname, 'paczka-kodu.js'), SRV, '--wersja', NOWA], { encoding: 'utf8' });
ok('paczka-kodu.js', pk.status === 0, (pk.stdout + pk.stderr).trim());
let manifest = JSON.parse(fs.readFileSync(path.join(SRV, 'aktualizacja.json'), 'utf8'));
ok('manifest', manifest.wersja === NOWA && manifest.electron === ELECTRON && manifest.kod.sha256 && manifest.pelna && manifest.pelna.rozmiar > 0);

let zepsujSume = false;
const serwer = http.createServer((req, res) => {
  const adres = `http://127.0.0.1:${serwer.address().port}`;
  if (req.url === '/latest') {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ tag_name: 'v' + NOWA, html_url: adres + '/strona', body: '## What\'s Changed\n* Coś nowego by @ktos in https://x',
      assets: ['aktualizacja.json', 'kod.zip', 'Generator-kart.zip'].map((n) => ({ name: n, browser_download_url: `${adres}/pliki/${n}` })) }));
  }
  const n = decodeURIComponent(req.url.replace('/pliki/', ''));
  if (n === 'aktualizacja.json' && zepsujSume) return res.end(JSON.stringify({ ...manifest, kod: { ...manifest.kod, sha256: '0'.repeat(64) } }));
  const p = path.join(SRV, path.basename(n));
  if (!fs.existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader('Content-Length', fs.statSync(p).size);
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise((r) => serwer.listen(0, '127.0.0.1', r));
  const ADRES = `http://127.0.0.1:${serwer.address().port}/latest`;

  // Porównanie wersji
  ok('porownajWersje', porownajWersje('0.4.10', '0.4.9') > 0 && porownajWersje('1.0', '1.0.0') === 0 && porownajWersje('0.4.12', '0.4.13') < 0);
  ok('folderAplikacji', akt.folderAplikacji('/Applications/Generator kart.app/Contents/MacOS/Generator kart') === '/Applications/Generator kart.app'
    && akt.folderAplikacji('/home/x/node_modules/electron/dist/electron') === null);

  // Sprawdzanie
  const info = await akt.sprawdz({ wersja: WBUDOWANA, electron: ELECTRON, adres: ADRES });
  ok('sprawdz: mała aktualizacja', info.dostepna && info.rodzaj === 'kod' && info.najnowsza === NOWA && info.rozmiar === manifest.kod.rozmiar);
  const innyElectron = await akt.sprawdz({ wersja: WBUDOWANA, electron: '1.0.0', adres: ADRES });
  ok('sprawdz: inny Electron → pełna', innyElectron.rodzaj === 'pelna' && innyElectron.rozmiar === manifest.pelna.rozmiar);
  const aktualna = await akt.sprawdz({ wersja: NOWA, electron: ELECTRON, adres: ADRES });
  ok('sprawdz: najnowsza = brak aktualizacji', aktualna.dostepna === false);

  // Instalacja nakładki
  const dane = path.join(T, 'dane');
  let postep = 0;
  await akt.zainstalujKod(info, dane, { postep: (f) => { postep = f; } });
  const kod = path.join(dane, 'kod');
  const meta = JSON.parse(fs.readFileSync(path.join(kod, 'nakladka.json'), 'utf8'));
  ok('zainstalujKod', fs.existsSync(path.join(kod, 'main.js')) && fs.existsSync(path.join(kod, 'zasoby', 'karty.html'))
    && !fs.existsSync(path.join(kod, 'start.js')) && meta.wersja === NOWA && meta.electron === ELECTRON && postep === 1
    && !fs.existsSync(path.join(dane, 'kod-nowy')) && !fs.readdirSync(path.join(dane, 'pobrane')).length);

  // Zepsuta suma – instalacja odrzucona, poprzednia nakładka zostaje.
  zepsujSume = true;
  const zla = await akt.sprawdz({ wersja: WBUDOWANA, electron: ELECTRON, adres: ADRES });
  let blad = '';
  try { await akt.zainstalujKod(zla, dane); } catch (e) { blad = e.message; }
  zepsujSume = false;
  ok('zła suma SHA-256 → odrzucona', /SHA-256/.test(blad) && fs.existsSync(path.join(kod, 'main.js')), blad);

  // Wybór nakładki przy starcie
  const w1 = wybierzNakladke(kod, { wbudowana: WBUDOWANA, electron: ELECTRON });
  ok('nakładka wybrana', w1.dir === kod && w1.wersja === NOWA && fs.existsSync(w1.znacznik));
  const w2 = wybierzNakladke(kod, { wbudowana: WBUDOWANA, electron: ELECTRON });
  ok('start bez potwierdzenia → nakładka zepsuta', w2.dir === null && fs.readFileSync(path.join(kod, 'zepsuta'), 'utf8') === NOWA, w2.powod);
  fs.rmSync(path.join(kod, 'zepsuta'));
  ok('nakładka: inny Electron', wybierzNakladke(kod, { wbudowana: WBUDOWANA, electron: '1.0.0', zapisz: false }).dir === null);
  ok('nakładka: paczka nowsza', wybierzNakladke(kod, { wbudowana: '10.0.0', electron: ELECTRON, zapisz: false }).dir === null);
  ok('nakładka: brak', wybierzNakladke(path.join(T, 'nie-ma'), { wbudowana: WBUDOWANA, electron: ELECTRON }).dir === null);

  // Pełna aktualizacja: pobranie i podmiana (na macOS podpis udawanej .app by nie przeszedł – tylko Linux).
  if (process.platform !== 'darwin') {
    const nowa = await akt.przygotujPelna(innyElectron, dane);
    ok('przygotujPelna', fs.readFileSync(path.join(nowa, 'Contents', 'nowa.txt'), 'utf8') === NOWA);
    const stara = path.join(T, 'Programy', 'Generator kart.app');
    fs.mkdirSync(path.join(stara, 'Contents'), { recursive: true });
    fs.writeFileSync(path.join(stara, 'Contents', 'stara.txt'), 'stara');
    ok('moznaPodmienic', akt.moznaPodmienic(stara) && !akt.moznaPodmienic(null));
    const czeka = spawn('sleep', ['1']);
    const skrypt = akt.zaplanujPodmiane({ nowa, stara, pid: czeka.pid, dane, otworz: 'echo otwieram' });
    const t0 = Date.now();
    spawnSync('/bin/bash', [skrypt]);
    const log = fs.readFileSync(path.join(dane, 'pobrane', 'podmiana.log'), 'utf8');
    ok('podmiana po zamknięciu', Date.now() - t0 >= 800 && fs.existsSync(path.join(stara, 'Contents', 'nowa.txt'))
      && !fs.existsSync(path.join(stara, 'Contents', 'stara.txt')) && !fs.existsSync(stara + '.stara-wersja') && /gotowe/.test(log) && /otwieram/.test(log)
      && !fs.existsSync(skrypt));
  }

  if (process.argv.includes('--electron')) await testElectron(ADRES);
  serwer.close();
  console.log(wyniki.join('\n'));
  if (!process.exitCode) fs.rmSync(T, { recursive: true, force: true }); else console.log('pliki testu:', T);
})().catch((e) => { console.error(e); process.exit(1); });

// Aplikacja: (1) bez nakładki – kod z paczki; zlecenie „aktualizacja” (instaluj = tak) instaluje nakładkę;
// (2) następny start – kod z nakładki 9.9.9, pełny test przykładu przechodzi.
async function testElectron(ADRES) {
  const bin = path.join(APP, 'node_modules', '.bin', 'electron');
  const ud = path.join(T, 'ud');
  const uruchom = (folder, extra = []) => new Promise((ok) => {
    const p = spawn('xvfb-run', ['-a', bin, '--no-sandbox', `--user-data-dir=${ud}`, APP, ...extra, '--test-pdf', folder, path.join(T, path.basename(folder) + '.pdf')],
      { env: { ...process.env, GENERATOR_KART_AKTUALIZACJE: ADRES } });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('close', () => {
      try { ok(JSON.parse(out.split('\n').filter((l) => l.startsWith('{')).pop())); } catch (e) { ok({ blad: out.slice(-500) }); }
    });
  });
  const kopia = (n) => { const d = path.join(T, n); fs.cpSync(path.join(APP, '..', 'przyklady', '01-wyprawa'), d, { recursive: true }); return d; };
  const r1 = await uruchom(kopia('p1'), ['--test-aktualizacja']);
  ok('aplikacja: kod z paczki', r1.ok && r1.kod && r1.kod.zrodlo === 'paczka', JSON.stringify(r1.kod || r1.blad));
  ok('aplikacja: zlecenie aktualizacja', !!r1.aktualizacja && r1.aktualizacja.ok, JSON.stringify(r1.aktualizacja));
  ok('nakładka po zleceniu', fs.existsSync(path.join(ud, 'kod', 'main.js')));
  const r2 = await uruchom(kopia('p2'));
  ok('aplikacja: kod z nakładki', r2.ok && r2.kod && r2.kod.zrodlo === 'nakładka' && r2.kod.wersja === NOWA, JSON.stringify(r2.kod || r2.blad));
  const pozostale = fs.readdirSync(path.join(ud, 'kod')).filter((n) => n.startsWith('start-') || n === 'zepsuta');
  ok('znacznik startu usunięty', !pozostale.length, pozostale.join(', '));
}
