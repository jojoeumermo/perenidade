// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Roda Python dentro do navegador, em uma linha de execução separada, para a página não travar.
// Antes de tudo: o código de quem estuda não alcança a sessão, o chaveiro nem outro Worker (veja isolar.js).
importScripts("/workers/isolar.js");
importScripts("/pyodide/pyodide.js");
let pronto = null;

self.onmessage = async (evento) => {
  const { code, input } = evento.data;
  try {
    pronto ??= loadPyodide({ indexURL: "/pyodide/" });
    const py = await pronto;
    self.postMessage({ type: "ready" });
    // input(): cada chamada consome uma linha do campo "Entradas".
    const linhas = String(input ?? "").split("\n");
    let proxima = 0;
    py.setStdin({ stdin: () => (proxima < linhas.length ? linhas[proxima++] : null) });
    py.setStdout({ batched: (texto) => self.postMessage({ type: "out", text: texto + "\n" }) });
    py.setStderr({ batched: (texto) => self.postMessage({ type: "err", text: texto + "\n" }) });
    await py.runPythonAsync(code);
  } catch (erro) {
    // Só a última linha do erro do Python: é a que diz o que aconteceu.
    const texto = String(erro && erro.message ? erro.message : erro).trim().split("\n");
    self.postMessage({ type: "err", text: texto.slice(-3).join("\n") + "\n" });
  }
  self.postMessage({ type: "done" });
};
