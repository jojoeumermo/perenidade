// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Roda PHP dentro do navegador, em uma linha de execução separada, para a página não travar.
// O interpretador foi compilado para a janela do navegador; aqui ele ganha o mínimo que espera encontrar.
// Antes de tudo: o código de quem estuda não alcança a sessão, o chaveiro nem outro Worker (veja isolar.js).
import "/workers/isolar.js";

self.window ??= self;
self.document ??= { baseURI: self.location.href, currentScript: null, addEventListener() {}, removeEventListener() {} };

let php = null;

self.onmessage = async (evento) => {
  try {
    if (!php) {
      const { PhpWeb } = await import("/php/PhpWeb.mjs");
      php = new PhpWeb({ version: "8.3" });
      php.addEventListener("output", (saida) => self.postMessage({ type: "out", text: saida.detail.join("") }));
      php.addEventListener("error", (saida) => self.postMessage({ type: "err", text: saida.detail.join("") }));
      await php.binary;
    }
    self.postMessage({ type: "ready" });
    const codigo = String(evento.data.code ?? "");
    await php.run(/^\s*<\?/.test(codigo) ? codigo : `<?php\n${codigo}`);
  } catch (erro) {
    self.postMessage({ type: "err", text: String(erro && erro.message ? erro.message : erro) + "\n" });
  }
  self.postMessage({ type: "done" });
};
