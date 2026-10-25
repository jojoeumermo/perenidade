// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o código de quem estuda pode alcançar quando roda no navegador. Os executores (Python, PHP, Ruby, Lua, C,
// TypeScript e JavaScript, na IDE, nas aulas e nas ferramentas) rodam numa linha de execução separada (Worker), que não
// enxerga a página. Mas o Worker é do mesmo endereço do site, e por isso ainda alcançava três coisas que não são dele:
//   - o canal entre abas (BroadcastChannel) por onde o serviço de contas repassa a sessão a cada renovação, com o token
//     de renovação junto: um programa colado de um link podia esperar a próxima renovação e levar a conta;
//   - o IndexedDB, onde fica o chaveiro das conversas cifradas (a identidade da pessoa e a chave do aparelho);
//   - o armazenamento do modo sem internet (caches) e a criação de outro Worker, que nasceria sem estas travas.
// Este trecho roda antes de qualquer código de fora e fecha os quatro de vez (não dá para reabrir: as propriedades
// ficam travadas). Os interpretadores não precisam de nenhum deles.
//
// O mesmo texto está em public/workers/isolar.js, carregado no começo de cada Worker de arquivo; os Workers montados na
// hora (JavaScript) recebem este texto no começo. scripts/testar-isolamento.mjs confere que os dois são iguais e que as
// travas funcionam.
export const ISOLAR_WORKER = `(function () {
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
`;
