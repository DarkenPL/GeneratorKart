'use strict';
// Test historii wersji (bez Electrona): node scripts/test-historia.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const H = require('../historia');
const { execFileSync } = require('child_process');

// W GitHub Actions błąd także jako adnotacja (widoczna w API bez pobierania logów).
if (process.env.GITHUB_ACTIONS) process.on('uncaughtException', (e) => {
  const t = [e.stack || String(e), e.stdout, e.stderr].filter(Boolean).join('\n');
  console.error(t);
  console.log('::error title=test-historia::' + t.replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A'));
  process.exit(1);
});

// Wariant „bez prawa usuwania” (jak powłoka na Macu bez zgody): unlink/rm rzucają EPERM, reszta działa.
// Uruchamiany w osobnym procesie z limitem czasu – zawieszenie (dawny błąd przy starej blokadzie) nie blokuje testu.
if (process.argv[2] === '--bez-usuwania') {
  const eperm = () => { const e = new Error('EPERM: operation not permitted'); e.code = 'EPERM'; throw e; };
  fs.unlinkSync = eperm; fs.rmSync = eperm;
  const d = process.argv[3], T = Date.UTC(2026, 0, 1), M = 60000;
  const blok = path.join(d, H.FOLDER, 'indeks.lock');
  fs.writeFileSync(path.join(d, 'k.csv'), '1');
  assert.strictEqual(H.zapisz(d, ['k.csv'], { powod: 'punkt', etykieta: 'a' }, T), 1);
  assert.ok(!fs.existsSync(blok) && fs.existsSync(blok + '.wolna'), 'blokada przeniesiona na indeks.lock.wolna');
  fs.writeFileSync(path.join(d, 'k.csv'), '2');
  assert.strictEqual(H.zapisz(d, ['k.csv'], { powod: 'punkt', etykieta: 'b' }, T + M), 1, 'drugi punkt zaraz po pierwszym');
  // stara blokada (> 10 s) – dawniej pętla bez końca
  fs.writeFileSync(blok, ''); const st = new Date(Date.now() - 20000); fs.utimesSync(blok, st, st);
  fs.writeFileSync(path.join(d, 'k.csv'), '3');
  assert.strictEqual(H.zapisz(d, ['k.csv'], { powod: 'punkt', etykieta: 'c' }, T + 2 * M), 1, 'punkt przy starej blokadzie');
  assert.ok(!fs.existsSync(blok));
  // świeża blokada (inny program pisze) – po ~5 s błąd „zajęta”, nie zawieszenie
  // (data w przyszłości – na wolnym komputerze czekanie może trwać > 10 s i blokada uznana byłaby za starą)
  fs.writeFileSync(blok, ''); const przysz = new Date(Date.now() + 120000); fs.utimesSync(blok, przysz, przysz);
  assert.throws(() => H.zapisz(d, ['k.csv'], null, T + 3 * M), /zajęta/);
  fs.renameSync(blok, blok + '.wolna');
  // skrzynka: punkt powstaje, folder znika ze skrzynki (do zaimportowane/), drugi import nic nie robi
  const skr = path.join(d, H.FOLDER, H.SKRZYNKA, '2026-01-01T00-30-00');
  fs.mkdirSync(skr, { recursive: true });
  fs.writeFileSync(path.join(skr, 'k.csv'), 'ze skrzynki');
  fs.writeFileSync(path.join(skr, 'opis.txt'), 'Claude: skrzynka\n');
  assert.strictEqual(H.sprawdzSkrzynke(d, T + 4 * M), 1);
  assert.deepStrictEqual(fs.readdirSync(path.join(d, H.FOLDER, H.SKRZYNKA)), []);
  assert.strictEqual(fs.readdirSync(path.join(d, H.FOLDER, H.ZAIMPORTOWANE)).length, 1);
  assert.strictEqual(H.sprawdzSkrzynke(d, T + 5 * M), 0);
  assert.deepStrictEqual(H.wczytajIndeks(d).punkty.map((p) => p.etykieta), ['a', 'b', 'c', 'Claude: skrzynka']);
  // przerzedzanie bez usuwania: kopie znikają z indeksu, pliki zostają (sprzątnie je zapis z prawem usuwania)
  for (let i = 1; i <= 120; i++) { fs.writeFileSync(path.join(d, 'k.csv'), 'p' + i); H.zapisz(d, ['k.csv'], null, T + (10 + i) * M); }
  const n = H.wczytajIndeks(d).wersje.length;
  assert.ok(fs.readdirSync(path.join(d, H.FOLDER, 'pliki')).length > n, 'sieroty w pliki/ (bez prawa usuwania)');
  console.log('bez-usuwania: OK');
  process.exit(0);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
const pisz = (p, t) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), t); };
const czytaj = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const MIN = 60000, T0 = Date.UTC(2026, 0, 1);

// 1) Kopia tylko przy zmianie treści.
pisz('Szablony/gra.txt', 'A');
pisz('karty.csv', 'ID;Nazwa\n1;x');
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], { powod: 'otwarcie' }, T0), 2);
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], null, T0 + MIN), 0);
pisz('Szablony/gra.txt', 'B');
assert.strictEqual(H.zapisz(dir, ['Szablony/gra.txt', 'karty.csv'], null, T0 + 2 * MIN), 1);

// 2) Ścieżki spoza projektu są pomijane.
assert.strictEqual(H.zapisz(dir, ['../poza.txt'], null, T0 + 3 * MIN), 0);

// 3) Przywrócenie stanu z otwarcia (A) + punkt „przed przywróceniem” (B zostaje w historii).
const zm = H.przywroc(dir, T0, T0 + 4 * MIN);
assert.deepStrictEqual(zm, ['Szablony/gra.txt']);
assert.strictEqual(czytaj('Szablony/gra.txt'), 'A');
const idx = H.wczytajIndeks(dir);
assert.ok(idx.punkty.some((p) => p.powod === 'przed przywróceniem'));
assert.strictEqual(H.stan(dir, T0 + 4 * MIN).find((s) => s.plik === 'Szablony/gra.txt').dane.toString(), 'B');

// 4) Przerzedzanie: 300 zmian co minutę przez 5 godzin → ostatnia godzina co 5 min, starsze co godzinę.
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
fs.writeFileSync(path.join(dir2, 'k.csv'), '0');
H.zapisz(dir2, ['k.csv'], { powod: 'punkt', etykieta: 'start' }, T0);
for (let i = 1; i <= 300; i++) { fs.writeFileSync(path.join(dir2, 'k.csv'), String(i)); H.zapisz(dir2, ['k.csv'], null, T0 + i * MIN); }
const w = H.wczytajIndeks(dir2).wersje;
assert.ok(w.length >= 14 && w.length <= 22, 'liczba kopii po przerzedzeniu: ' + w.length);
assert.ok(w.some((v) => v.czas === T0), 'kopia punktu „start” zostaje');
assert.ok(w.some((v) => v.czas === T0 + 300 * MIN), 'najnowsza zostaje');
assert.strictEqual(fs.readdirSync(path.join(dir2, H.FOLDER, 'pliki')).length, w.length, 'usunięte pliki kopii');
// Stan z punktu „start” da się odtworzyć.
assert.strictEqual(H.stan(dir2, T0)[0].dane.toString(), '0');

// 5) Skrzynka: folder z kopią i opisem → punkt z opisem, kopia w historii, folder usunięty.
const dir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
fs.writeFileSync(path.join(dir3, 'k.csv'), 'nowe');
H.zapisz(dir3, ['k.csv'], null, T0 + 10 * MIN);
const skr = path.join(dir3, H.FOLDER, H.SKRZYNKA, '2026-01-01T00-05-00');
fs.mkdirSync(skr, { recursive: true });
fs.writeFileSync(path.join(skr, 'k.csv'), 'stare');
fs.writeFileSync(path.join(skr, 'opis.txt'), 'Claude: przed zmianą\n');
assert.strictEqual(H.sprawdzSkrzynke(dir3, T0 + 11 * MIN), 1);
const i3 = H.wczytajIndeks(dir3);
const pk = i3.punkty.find((p) => p.etykieta === 'Claude: przed zmianą');
assert.ok(pk, 'punkt ze skrzynki');
assert.strictEqual(H.stan(dir3, pk.czas)[0].dane.toString(), 'stare');
assert.ok(!fs.existsSync(skr), 'folder skrzynki usunięty');
assert.strictEqual(H.sprawdzSkrzynke(dir3), 0);

// 6) Blokada: zajęty indeks czeka, stara blokada (>10 s) jest zdejmowana.
const blok = path.join(dir3, H.FOLDER, 'indeks.lock');
fs.writeFileSync(blok, '');
const stara = new Date(Date.now() - 20000); fs.utimesSync(blok, stara, stara);
fs.writeFileSync(path.join(dir3, 'k.csv'), 'po blokadzie');
assert.strictEqual(H.zapisz(dir3, ['k.csv']), 1);
assert.ok(!fs.existsSync(blok));

// 7) Polecenie z konsoli na kopii przykładu.
const cli = (...a) => execFileSync(process.execPath, [path.join(__dirname, '..', 'historia-cli.js'), ...a], { encoding: 'utf8' });
const dir4 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
fs.cpSync(path.join(__dirname, '..', '..', 'przyklady', '01-wyprawa'), dir4, { recursive: true });
const szablon = path.join(dir4, 'Szablony', fs.readdirSync(path.join(dir4, 'Szablony'))[0]);
const oryg = fs.readFileSync(szablon, 'utf8');
assert.match(cli('punkt', dir4, 'Claude: przed'), /nowe kopie: [1-9]/);
const sledzone = H.wczytajIndeks(dir4).wersje.map((v) => v.plik);
assert.ok(sledzone.some((p) => p.startsWith('Szablony/')) && sledzone.some((p) => /\.csv$/.test(p)), 'szablon i dane: ' + sledzone);
fs.writeFileSync(szablon, oryg + '\n; zmiana\n');
cli('punkt', szablon, 'Claude: po');
const l = JSON.parse(cli('lista', dir4, '--json'));
assert.deepStrictEqual(l.map((x) => x.punkty[0]), ['Claude: po', 'Claude: przed']);
assert.match(cli('przywroc', path.join(dir4, 'Szablony'), '2'), /Przywrócono/);
assert.strictEqual(fs.readFileSync(szablon, 'utf8'), oryg);
assert.match(cli('lista', dir4), /stan sprzed przywrócenia/);

// 8) Siatka bezpieczeństwa i punkty eksportu.
const dir5 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
const siatka = { powod: 'siatka', etykieta: 'Siatka bezpieczeństwa', jesliZmiany: true, minOdstep: 60 * MIN };
fs.writeFileSync(path.join(dir5, 'k.csv'), 'a');
H.zapisz(dir5, ['k.csv'], { powod: 'otwarcie' }, T0);
// bez zmian → ani kopii, ani punktu
assert.strictEqual(H.zapisz(dir5, ['k.csv'], { ...siatka, minOdstep: 0 }, T0 + 5 * MIN), 0);
assert.ok(!H.wczytajIndeks(dir5).punkty.some((p) => p.powod === 'siatka'));
// zmiana, ale ostatnia kopia młodsza niż godzina → nic
fs.writeFileSync(path.join(dir5, 'k.csv'), 'b');
assert.strictEqual(H.zapisz(dir5, ['k.csv'], siatka, T0 + 30 * MIN), 0);
// po godzinie → kopia z punktem siatki (opcje nie trafiają do indeksu)
assert.strictEqual(H.zapisz(dir5, ['k.csv'], siatka, T0 + 61 * MIN), 1);
const ps = H.wczytajIndeks(dir5).punkty.filter((p) => p.powod === 'siatka');
assert.deepStrictEqual(ps.map((p) => Object.keys(p).sort()), [['czas', 'etykieta', 'powod']]);
// eksport bez zmian: punkt raz, drugi taki sam nie jest dublowany; inny opis – nowy punkt
H.zapisz(dir5, ['k.csv'], { powod: 'eksport', etykieta: 'PDF A4' }, T0 + 62 * MIN);
H.zapisz(dir5, ['k.csv'], { powod: 'eksport', etykieta: 'PDF A4' }, T0 + 63 * MIN);
H.zapisz(dir5, ['k.csv'], { powod: 'eksport', etykieta: 'eksport JPG 150 dpi' }, T0 + 64 * MIN);
assert.deepStrictEqual(H.wczytajIndeks(dir5).punkty.filter((p) => p.powod === 'eksport').map((p) => p.etykieta), ['PDF A4', 'eksport JPG 150 dpi']);
// zostaje 24 ostatnich punktów siatki
for (let i = 1; i <= 30; i++) { fs.writeFileSync(path.join(dir5, 'k.csv'), 'z' + i); H.zapisz(dir5, ['k.csv'], siatka, T0 + (61 + i * 61) * MIN); }
assert.strictEqual(H.wczytajIndeks(dir5).punkty.filter((p) => p.powod === 'siatka').length, 24);

// 9) Bez prawa usuwania (osobny proces, limit 2 min – zawieszenie nie blokuje CI), potem sprzątanie przy zapisie z prawem usuwania.
const dir6 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
assert.match(execFileSync(process.execPath, [__filename, '--bez-usuwania', dir6], { encoding: 'utf8', timeout: 120000 }), /bez-usuwania: OK/);
fs.writeFileSync(path.join(dir6, 'k.csv'), 'z prawem usuwania');
H.zapisz(dir6, ['k.csv'], { powod: 'punkt', etykieta: 'sprzątanie' }, T0 + 200 * MIN);
const i6 = H.wczytajIndeks(dir6);
assert.deepStrictEqual(fs.readdirSync(path.join(dir6, H.FOLDER, 'pliki')).sort(), i6.wersje.map((v) => v.id).sort(), 'w pliki/ tylko kopie z indeksu');
assert.ok(!fs.existsSync(path.join(dir6, H.FOLDER, 'indeks.lock.wolna')), 'indeks.lock.wolna sprzątnięty');
assert.ok(!fs.existsSync(path.join(dir6, H.FOLDER, H.ZAIMPORTOWANE)), 'zaimportowane/ sprzątnięte');
assert.ok(!fs.existsSync(path.join(dir6, H.FOLDER, 'indeks.lock')));
assert.strictEqual(H.stan(dir6, i6.punkty.find((p) => p.etykieta === 'a').czas)[0].dane.toString(), '1', 'stan z punktu sprzed sprzątania');
// Uszkodzony indeks: kopie zostają (nie są „spoza indeksu”).
const dir7 = fs.mkdtempSync(path.join(os.tmpdir(), 'historia-'));
fs.writeFileSync(path.join(dir7, 'k.csv'), 'x');
H.zapisz(dir7, ['k.csv'], null, T0);
fs.writeFileSync(path.join(dir7, H.FOLDER, 'indeks.json'), '{ zepsuty');
fs.writeFileSync(path.join(dir7, 'k.csv'), 'y');
H.zapisz(dir7, ['k.csv'], null, T0 + MIN);
assert.strictEqual(fs.readdirSync(path.join(dir7, H.FOLDER, 'pliki')).length, 2, 'stara kopia nie usunięta przy uszkodzonym indeksie');

console.log('historia: OK (' + w.length + ' kopii po przerzedzeniu; skrzynka, blokada, konsola, siatka, eksporty, bez prawa usuwania)');
