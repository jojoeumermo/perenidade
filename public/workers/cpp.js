// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Roda C e C++ (o essencial: iostream, cstdio, cmath, cstring, cstdlib, ctime) com o interpretador JSCPP, numa linha
// de execução separada. Não é um compilador de verdade: serve para aprender a linguagem, não para bibliotecas grandes.
// O JSCPP vem em módulos CommonJS; um require mínimo os carrega do próprio site.
// Antes de tudo: o código de quem estuda não alcança a sessão, o chaveiro nem outro Worker (veja isolar.js).
importScripts("/workers/isolar.js");
const BASE = "/jscpp/";
const EXTERNOS = { lodash: BASE + "lodash.js", "pegjs-util": BASE + "PEGUtil.js", printf: BASE + "printf.js" };
const SIMULADOS = { util: { inspect: (x) => JSON.stringify(x) }, stream: { Stream: function Stream() {} } };
const cache = {};

function carregar(caminho) {
  if (cache[caminho]) return cache[caminho].exports;
  const x = new XMLHttpRequest();
  x.open("GET", caminho, false);
  x.send();
  if (x.status !== 200) throw new Error("Não achei " + caminho);
  const modulo = { exports: {} };
  cache[caminho] = modulo;
  const pasta = caminho.slice(0, caminho.lastIndexOf("/") + 1);
  const requerer = (nome) => {
    if (nome in SIMULADOS) return SIMULADOS[nome];
    if (nome in EXTERNOS) return carregar(EXTERNOS[nome]);
    if (nome.startsWith(".")) {
      let alvo = new URL(nome, "https://x" + pasta).pathname;
      if (!alvo.endsWith(".js")) alvo += ".js";
      return carregar(alvo);
    }
    throw new Error("Módulo indisponível: " + nome);
  };
  new Function("module", "exports", "require", x.responseText + "\n//# sourceURL=" + caminho)(modulo, modulo.exports, requerer);
  return modulo.exports;
}

let JSCPP = null;
self.onmessage = (evento) => {
  const { code, input } = evento.data;
  try {
    JSCPP ??= carregar(BASE + "lib/launcher.js").default;
    self.postMessage({ type: "ready" });
    const codigo = JSCPP.run(code, String(input ?? ""), {
      stdio: { write: (s) => self.postMessage({ type: "out", text: s }) },
      maxTimeout: 15000,
      unsigned_overflow: "warn",
    });
    self.postMessage({ type: "out", text: `\n[o programa terminou com o código ${codigo}]\n` });
  } catch (erro) {
    self.postMessage({ type: "err", text: String(erro && erro.message ? erro.message : erro) + "\n" });
  }
  self.postMessage({ type: "done" });
};
