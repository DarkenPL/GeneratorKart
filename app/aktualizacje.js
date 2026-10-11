'use strict';
// Aktualizacje aplikacji bez podpisu Apple Developer (bez Squirrel.Mac / electron-updater).
// Źródło: najnowsze wydanie na GitHubie (repozytorium publiczne – bez tokenu). Wydanie ma pliki:
//   aktualizacja.json  – manifest: { wersja, electron, kod: { plik, sha256, rozmiar }, pelna: { … } }
//   kod.zip            – sam kod aplikacji (≈ 1 MB) → nakładka w <dane aplikacji>/kod (nakladka.js)
//   Generator-kart.zip – cała aplikacja (≈ 120 MB) → podmiana w Programach po zamknięciu
// Nakładka wystarcza, gdy wydanie ma tego samego Electrona co działająca aplikacja; inaczej pełna podmiana.
// Pobrane pliki sprawdzamy sumą SHA-256 z manifestu. Plik pobrany przez aplikację nie dostaje
// atrybutu kwarantanny, więc Gatekeeper nie pyta (zatwierdzenie tylko przy pierwszej instalacji z DMG).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, spawn } = require('child_process');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { porownajWersje } = require('./nakladka');

const ADRES = process.env.GENERATOR_KART_AKTUALIZACJE || 'https://api.github.com/repos/DarkenPL/GeneratorKart/releases/latest';
const NAGLOWKI = { 'User-Agent': 'Generator-kart', Accept: 'application/vnd.github+json' };

// → { obecna, najnowsza, dostepna, rodzaj: 'kod' | 'pelna', rozmiar, manifest, pliki, strona, opis }
async function sprawdz({ wersja, electron, fetch = globalThis.fetch, adres = ADRES }) {
  const r = await fetch(adres, { headers: NAGLOWKI });
  if (!r.ok) throw new Error(`GitHub odpowiedział ${r.status}`);
  const wydanie = await r.json();
  const pliki = Object.fromEntries((wydanie.assets || []).map((a) => [a.name, a.browser_download_url]));
  if (!pliki['aktualizacja.json']) throw new Error(`wydanie ${wydanie.tag_name || ''} nie ma pliku aktualizacja.json`);
  const m = await fetch(pliki['aktualizacja.json'], { headers: { 'User-Agent': NAGLOWKI['User-Agent'] } });
  if (!m.ok) throw new Error(`aktualizacja.json: ${m.status}`);
  const manifest = await m.json();
  const dostepna = porownajWersje(manifest.wersja, wersja) > 0;
  const rodzaj = manifest.kod && manifest.electron === electron && pliki[manifest.kod.plik] ? 'kod' : 'pelna';
  const czesc = manifest[rodzaj];
  if (dostepna && (!czesc || !pliki[czesc.plik])) throw new Error(`wydanie ${manifest.wersja} nie ma pliku do aktualizacji (${rodzaj})`);
  return { obecna: wersja, najnowsza: manifest.wersja, dostepna, rodzaj, rozmiar: czesc ? czesc.rozmiar : 0,
    manifest, pliki, strona: wydanie.html_url || '', opis: String(wydanie.body || '') };
}

// Pobranie do pliku z kontrolą SHA-256; postep(ułamek 0–1).
async function pobierz(adres, cel, { sha256, rozmiar, fetch = globalThis.fetch, postep = () => {} }) {
  fs.mkdirSync(path.dirname(cel), { recursive: true });
  const r = await fetch(adres, { headers: { 'User-Agent': NAGLOWKI['User-Agent'] } });
  if (!r.ok || !r.body) throw new Error(`pobieranie: ${r.status}`);
  const calosc = rozmiar || +r.headers.get('content-length') || 0;
  const skrot = crypto.createHash('sha256');
  let ile = 0;
  const strumien = Readable.fromWeb(r.body);
  strumien.on('data', (c) => { skrot.update(c); ile += c.length; if (calosc) postep(Math.min(1, ile / calosc)); });
  const tmp = cel + '.czesc';
  await pipeline(strumien, fs.createWriteStream(tmp));
  const suma = skrot.digest('hex');
  if (sha256 && suma !== sha256) { fs.rmSync(tmp, { force: true }); throw new Error('pobrany plik jest uszkodzony (inna suma SHA-256)'); }
  fs.renameSync(tmp, cel);
  return cel;
}

// Rozpakowanie ZIP: ditto na macOS (zachowuje atrybuty i dowiązania w .app), unzip gdzie indziej (testy).
function rozpakuj(zip, cel) {
  fs.rmSync(cel, { recursive: true, force: true });
  fs.mkdirSync(cel, { recursive: true });
  const r = process.platform === 'darwin' ? spawnSync('/usr/bin/ditto', ['-x', '-k', zip, cel]) : spawnSync('unzip', ['-q', zip, '-d', cel]);
  if (r.status !== 0) throw new Error('nie udało się rozpakować: ' + String(r.stderr || r.error || '').trim());
}

// Mała aktualizacja: kod.zip → <dane>/kod (podmiana folderu w jednym kroku; stary kod usuwany).
async function zainstalujKod(info, dane, opcje = {}) {
  const { manifest, pliki } = info;
  const pobrane = path.join(dane, 'pobrane');
  const zip = await pobierz(pliki[manifest.kod.plik], path.join(pobrane, `kod-${manifest.wersja}.zip`), { ...manifest.kod, ...opcje });
  const nowy = path.join(dane, 'kod-nowy'), kod = path.join(dane, 'kod'), stary = path.join(dane, 'kod-stary');
  rozpakuj(zip, nowy);
  const pk = JSON.parse(fs.readFileSync(path.join(nowy, 'package.json'), 'utf8'));
  if (pk.version !== manifest.wersja || !fs.existsSync(path.join(nowy, 'main.js'))) {
    fs.rmSync(nowy, { recursive: true, force: true });
    throw new Error('paczka kodu nie pasuje do manifestu');
  }
  fs.writeFileSync(path.join(nowy, 'nakladka.json'), JSON.stringify({ wersja: manifest.wersja, electron: manifest.electron, data: new Date().toISOString() }, null, 1));
  fs.rmSync(stary, { recursive: true, force: true });
  if (fs.existsSync(kod)) fs.renameSync(kod, stary);
  fs.renameSync(nowy, kod);
  fs.rmSync(stary, { recursive: true, force: true });
  fs.rmSync(zip, { force: true });
  return kod;
}

// Folder aplikacji (.app), w którym działamy – albo null (np. uruchomienie z npm).
function folderAplikacji(execPath = process.execPath) {
  const m = /^(.*?\.app)(\/|$)/.exec(execPath);
  return m ? m[1] : null;
}

// Pełna aktualizacja, krok 1: pobranie i rozpakowanie nowej aplikacji, sprawdzenie podpisu.
// → ścieżka nowej .app (podmiana dopiero po zamknięciu – zaplanujPodmiane).
async function przygotujPelna(info, dane, opcje = {}) {
  const { manifest, pliki } = info;
  const pobrane = path.join(dane, 'pobrane');
  const zip = await pobierz(pliki[manifest.pelna.plik], path.join(pobrane, `Generator-kart-${manifest.wersja}.zip`), { ...manifest.pelna, ...opcje });
  const cel = path.join(pobrane, `pelna-${manifest.wersja}`);
  rozpakuj(zip, cel);
  fs.rmSync(zip, { force: true });
  const app = fs.readdirSync(cel).find((n) => n.endsWith('.app'));
  if (!app) throw new Error('w paczce nie ma aplikacji');
  const nowa = path.join(cel, app);
  if (process.platform === 'darwin') {
    const r = spawnSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', nowa]);
    if (r.status !== 0) throw new Error('pobrana aplikacja ma uszkodzony podpis: ' + String(r.stderr).trim());
  }
  return nowa;
}

// Czy możemy podmienić aplikację (zapis w folderze nad .app, np. /Applications)?
function moznaPodmienic(stara) {
  if (!stara) return false;
  try { fs.accessSync(path.dirname(stara), fs.constants.W_OK); fs.accessSync(stara, fs.constants.W_OK); return true; } catch (e) { return false; }
}

// Pełna aktualizacja, krok 2: skrypt czeka na zamknięcie aplikacji (pid), podmienia .app i (opcjonalnie)
// uruchamia nową. Gdy podmiana się nie uda, przywraca starą. Zwraca ścieżkę skryptu.
function zaplanujPodmiane({ nowa, stara, pid = process.pid, uruchom = true, dane, otworz = '/usr/bin/open' }) {
  const q = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";
  const zapas = stara + '.stara-wersja';
  const log = path.join(dane, 'pobrane', 'podmiana.log');
  const skrypt = path.join(dane, 'pobrane', 'podmiana.sh');
  fs.mkdirSync(path.dirname(skrypt), { recursive: true });
  fs.writeFileSync(skrypt, `#!/bin/bash
# Podmiana aplikacji Generator kart po jej zamknięciu (aktualizacje.js).
exec >> ${q(log)} 2>&1
echo "$(date) podmiana: ${nowa} → ${stara}"
for i in $(seq 1 600); do kill -0 ${pid} 2>/dev/null || break; sleep 0.2; done
rm -rf ${q(zapas)}
if mv ${q(stara)} ${q(zapas)} && mv ${q(nowa)} ${q(stara)}; then
  xattr -dr com.apple.quarantine ${q(stara)} 2>/dev/null
  rm -rf ${q(zapas)}
  echo "$(date) gotowe"
else
  echo "$(date) błąd – przywracam starą wersję"
  [ -e ${q(stara)} ] || mv ${q(zapas)} ${q(stara)}
fi
${uruchom ? `${otworz} ${q(stara)}` : ''}
rm -f ${q(skrypt)}
`, { mode: 0o755 });
  return skrypt;
}
function uruchomPodmiane(skrypt) {
  spawn('/bin/bash', [skrypt], { detached: true, stdio: 'ignore' }).unref();
}

module.exports = { sprawdz, pobierz, rozpakuj, zainstalujKod, przygotujPelna, folderAplikacji, moznaPodmienic, zaplanujPodmiane, uruchomPodmiane, ADRES };
