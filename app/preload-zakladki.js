'use strict';
// Most między paskiem zakładek (zakladki.html) a aplikacją. Stan zakładek przysyła main
// (`zakladki:stan`), a pasek zgłasza tylko kliknięcia: wybór, zamknięcie, nowa zakładka.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pasekZakladek', {
  naStan: (fn) => ipcRenderer.on('zakladki:stan', (e, stan) => fn(stan)),
  wybierz: (i) => ipcRenderer.send('zakladki:wybierz', i),
  zamknij: (i) => ipcRenderer.send('zakladki:zamknij', i),
  nowa: () => ipcRenderer.send('zakladki:nowa'),
});
