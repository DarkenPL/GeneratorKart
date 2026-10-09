'use strict';
// Test historii wersji (bez Electrona): node scripts/test-historia.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const H = require('../historia');

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
const { execFileSync } = require('child_process');
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

console.log('historia: OK (' + w.length + ' kopii po przerzedzeniu; skrzynka, blokada, konsola)');
