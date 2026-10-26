// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Fecha, para o código que roda neste Worker, o canal da sessão entre abas, o IndexedDB, os caches e a criação de outro
// Worker. Carregado antes de qualquer outra coisa. O texto é o mesmo de lib/isolamento.ts (veja lá o porquê).
(function () {
  "use strict";
  var fechada = { get: function () { return undefined; }, set: function () {}, enumerable: false, configurable: false };
  ["BroadcastChannel", "indexedDB", "caches", "Worker", "SharedWorker"].forEach(function (nome) {
    for (var alvo = self; alvo; alvo = Object.getPrototypeOf(alvo)) {
      if (alvo === self || Object.getOwnPropertyDescriptor(alvo, nome)) {
        try { Object.defineProperty(alvo, nome, fechada); } catch (e) { /* já travada */ }
      }
    }
  });
})();
