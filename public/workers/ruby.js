// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Roda Ruby 3.4 (o interpretador oficial, compilado para WebAssembly pelo projeto ruby.wasm) numa linha de execução separada.
importScripts("/ruby/browser.umd.js");
let modulo = null;

// O $stdout e o $stderr do Ruby escrevem direto aqui (o console quebraria as linhas do jeito dele).
self.__escrever = (tipo, texto) => self.postMessage({ type: String(tipo), text: String(texto) });
const SAIDA = `require "js"
class SaidaDaIde
  def initialize(tipo) = @tipo = tipo
  def write(*partes)
    texto = partes.join
    JS.global.call(:__escrever, @tipo, texto)
    texto.bytesize
  end
  def flush = self
  def sync = true
  def sync=(_); end
  def tty? = false
  def fileno = @tipo == "out" ? 1 : 2
end
$stdout = SaidaDaIde.new("out")
$stderr = SaidaDaIde.new("err")`;

self.onmessage = async (evento) => {
  const { code, input, arquivos } = evento.data;
  try {
    modulo ??= await WebAssembly.compileStreaming(fetch("/ruby/ruby+stdlib.wasm"));
    // Uma máquina nova a cada execução: nada de um programa vaza para o próximo.
    const { vm } = await self["ruby-wasm-wasi"].DefaultRubyVM(modulo, { consolePrint: false });
    self.postMessage({ type: "ready" });
    vm.eval(SAIDA);
    vm.eval('require "stringio"');
    vm.eval(`$stdin = StringIO.new(${JSON.stringify(String(input ?? ""))})\nmodule Kernel\n  def gets(*a) = $stdin.gets(*a)\nend`);
    // Os outros arquivos do projeto: require_relative "util" acha util.rb.
    const outros = (arquivos ?? []).filter((a) => a.nome.endsWith(".rb"));
    if (outros.length) {
      const mapa = outros.map((a) => `${JSON.stringify(a.nome.replace(/\.rb$/, ""))} => ${JSON.stringify(a.conteudo)}`).join(", ");
      vm.eval(`$__arquivos = {${mapa}}\nmodule Kernel\n  def require_relative(n)\n    n = n.sub(/\\.rb$/, "").sub(/^\\.\\//, "")\n    return false if ($__carregados ||= {})[n]\n    $__carregados[n] = true\n    eval($__arquivos.fetch(n), TOPLEVEL_BINDING, n + ".rb")\n    true\n  end\nend`);
    }
    vm.eval(code);
  } catch (erro) {
    self.postMessage({ type: "err", text: String(erro && erro.message ? erro.message : erro).trim().split("\n").slice(-4).join("\n") + "\n" });
  }
  self.postMessage({ type: "done" });
};
