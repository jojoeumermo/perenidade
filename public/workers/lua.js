// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Roda Lua 5.4 (o interpretador oficial, compilado para WebAssembly pelo projeto wasmoon) numa linha de execução separada.
// Antes de tudo: o código de quem estuda não alcança a sessão, o chaveiro nem outro Worker (veja isolar.js).
importScripts("/workers/isolar.js");
importScripts("/lua/index.js");
const fabrica = new wasmoon.LuaFactory("/lua/glue.wasm");

self.onmessage = async (evento) => {
  const { code, input, arquivos } = evento.data;
  let lua = null;
  try {
    // Os outros arquivos do projeto viram módulos: require("util") acha util.lua.
    for (const a of arquivos ?? []) if (a.nome.endsWith(".lua")) await fabrica.mountFile(a.nome, a.conteudo);
    lua = await fabrica.createEngine();
    self.postMessage({ type: "ready" });
    const linhas = String(input ?? "").split("\n");
    let proxima = 0;
    const texto = (v) => (v === null || v === undefined ? "nil" : typeof v === "object" || typeof v === "function" ? String(typeof v === "function" ? "function" : "table") : String(v));
    lua.global.set("print", (...a) => self.postMessage({ type: "out", text: a.map(texto).join("\t") + "\n" }));
    lua.global.set("__escrever", (s) => self.postMessage({ type: "out", text: String(s) }));
    lua.global.set("__ler", () => (proxima < linhas.length ? linhas[proxima++] : null));
    await lua.doString('package.path = "./?.lua;" .. package.path\nio.write = function(...) for _, v in ipairs({...}) do __escrever(tostring(v)) end end\nio.read = function(f) local l = __ler() if l and (f == "n" or f == "*n") then return tonumber(l) end return l end');
    await lua.doString(code);
  } catch (erro) {
    self.postMessage({ type: "err", text: String(erro && erro.message ? erro.message : erro) + "\n" });
  } finally {
    lua?.global.close();
  }
  self.postMessage({ type: "done" });
};
