'use strict';
// Lokalny serwer HTTP (tylko 127.0.0.1) – to samo, co robi „Uruchom generator.command”:
//   /karty.html       – generator (z zasobów aplikacji)
//   /.app/…           – zasoby aplikacji (biblioteki, czcionki)
//   /.wersja          – wersja serwera (karty.html sprawdza, czy umie spisy folderów)
//   /ścieżka          – pliki z folderu projektu; katalog → lista nazw jako JSON
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  html: 'text/html; charset=utf-8', css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8',
  json: 'application/json', csv: 'text/csv; charset=utf-8', txt: 'text/plain; charset=utf-8',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', pcio: 'application/zip',
};

// Ścieżka wewnątrz katalogu `root` albo null (bez wychodzenia poza folder i bez plików ukrytych).
function bezpieczna(root, rel) {
  if (!root) return null;
  if (rel.split('/').some((s) => s === '..' || s.startsWith('.'))) return null;
  const p = path.resolve(root, rel);
  return p === path.resolve(root) || p.startsWith(path.resolve(root) + path.sep) ? p : null;
}

function utworzSerwer({ zasoby, projekt }) {
  return http.createServer((req, res) => {
    const head = req.method === 'HEAD';
    const wyslij = (kod, typ, tresc, extra = {}) => {
      const buf = Buffer.isBuffer(tresc) ? tresc : Buffer.from(String(tresc));
      res.writeHead(kod, { 'Content-Type': typ, 'Content-Length': buf.length, 'Cache-Control': 'no-store', ...extra });
      res.end(head ? undefined : buf);
    };
    if (req.method !== 'GET' && !head) return wyslij(405, 'text/plain', '');

    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, ''); }
    catch (e) { return wyslij(400, 'text/plain', ''); }
    if (rel === '') rel = 'karty.html';

    if (rel === '.wersja') return wyslij(200, 'text/plain', '2');
    let plik;
    if (rel === 'karty.html') plik = path.join(zasoby, 'karty.html');
    else if (rel.startsWith('.app/')) plik = bezpieczna(zasoby, rel.slice(5));
    else plik = bezpieczna(projekt(), rel.replace(/\/+$/, ''));
    if (!plik) return wyslij(rel.startsWith('.') ? 403 : 404, 'text/plain', '');

    fs.stat(plik, (err, st) => {
      if (err) return wyslij(404, 'text/plain', 'Not Found');
      if (st.isDirectory()) {
        fs.readdir(plik, (e2, nazwy) => {
          if (e2) return wyslij(500, 'text/plain', '');
          wyslij(200, 'application/json; charset=utf-8', JSON.stringify(nazwy.filter((n) => !n.startsWith('.')).sort()));
        });
        return;
      }
      const ext = path.extname(plik).slice(1).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
        'Last-Modified': st.mtime.toUTCString(), 'Cache-Control': 'no-store',
      });
      if (head) return res.end();
      fs.createReadStream(plik).on('error', () => res.destroy()).pipe(res);
    });
  });
}

module.exports = { utworzSerwer };
