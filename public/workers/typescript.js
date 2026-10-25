// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
// Confere os tipos e traduz TypeScript para JavaScript dentro do navegador, numa linha de execução separada.
// O compilador é o oficial (pacote typescript), servido pelo próprio site. Devolve o JavaScript pronto (cada arquivo
// vira um módulo, com require entre eles) e os erros de tipo; quem roda é o executor de JavaScript da IDE.
// Antes de tudo: o código de quem estuda não alcança a sessão, o chaveiro nem outro Worker (veja isolar.js).
importScripts("/workers/isolar.js");
importScripts("/typescript/typescript.js");

const LIB = "/typescript/";
const textos = new Map();
const fontes = new Map();
// O console e o prompt que a IDE oferece: sem a biblioteca inteira do navegador (lib.dom), que pesa e confunde.
const AMBIENTE = "declare var console: { log(...a: any[]): void; info(...a: any[]): void; warn(...a: any[]): void; error(...a: any[]): void; table(...a: any[]): void };\ndeclare function prompt(mensagem?: string): string | null;\n";

function lerBiblioteca(nome) {
  if (!nome.startsWith(LIB) || !/\/lib\.[\w.]+\.d\.ts$/.test(nome)) return undefined;
  if (!textos.has(nome)) {
    const x = new XMLHttpRequest();
    x.open("GET", nome, false);
    x.send();
    textos.set(nome, x.status === 200 ? x.responseText : undefined);
  }
  return textos.get(nome);
}

self.onmessage = (evento) => {
  const { arquivos, principal = "main.ts" } = evento.data;
  self.postMessage({ type: "ready" });
  try {
    const projeto = new Map(arquivos.map((a) => ["/projeto/" + a.nome, a.conteudo]));
    projeto.set("/projeto/__ambiente.d.ts", AMBIENTE);
    const ler = (nome) => (projeto.has(nome) ? projeto.get(nome) : lerBiblioteca(nome));
    const saida = {};
    const opcoes = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, strict: true, esModuleInterop: true, lib: ["lib.es2022.d.ts"], types: [], skipLibCheck: true };
    const host = {
      getSourceFile(nome, versao) {
        const texto = ler(nome);
        if (texto === undefined) return undefined;
        if (!nome.startsWith(LIB)) return ts.createSourceFile(nome, texto, versao);
        if (!fontes.has(nome)) fontes.set(nome, ts.createSourceFile(nome, texto, versao));
        return fontes.get(nome);
      },
      getDefaultLibFileName: () => LIB + "lib.es2022.d.ts",
      getDefaultLibLocation: () => LIB.slice(0, -1),
      writeFile: (nome, texto) => { saida[nome] = texto; },
      getCurrentDirectory: () => "/projeto",
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => "\n",
      fileExists: (nome) => ler(nome) !== undefined,
      readFile: ler,
      directoryExists: (d) => d === "/projeto" || d === LIB.slice(0, -1),
      getDirectories: () => [],
    };
    const raizes = [...projeto.keys()].filter((n) => /\.tsx?$/.test(n));
    const programa = ts.createProgram(raizes, opcoes, host);
    programa.emit();
    const erros = ts.getPreEmitDiagnostics(programa).map((d) => {
      const texto = ts.flattenDiagnosticMessageText(d.messageText, "\n");
      if (!d.file) return texto;
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      return `${d.file.fileName.replace("/projeto/", "")}:${line + 1}:${character + 1} — ${texto}`;
    });
    // Os módulos compilados num só script, com um require mínimo entre eles ("./util" acha util.js).
    const modulos = Object.entries(saida)
      .filter(([n]) => n.endsWith(".js"))
      .map(([n, js]) => `${JSON.stringify(n.replace("/projeto/", "").replace(/\.js$/, ""))}: function (module, exports, require) {\n${js}\n}`);
    const js = [
      `const __m = {${modulos.join(",\n")}};`,
      "const __c = {};",
      'const __r = (n) => { n = n.replace(/^\\.\\//, "").replace(/\\.(js|ts)$/, ""); if (__c[n]) return __c[n].exports; if (!__m[n]) throw new Error("Módulo não encontrado: " + n); const m = { exports: {} }; __c[n] = m; __m[n](m, m.exports, __r); return m.exports; };',
      `__r(${JSON.stringify(principal.replace(/\.tsx?$/, ""))});`,
    ].join("\n");
    self.postMessage({ type: "compiled", js, erros });
  } catch (erro) {
    self.postMessage({ type: "err", text: String(erro && erro.message ? erro.message : erro) + "\n" });
    self.postMessage({ type: "done" });
  }
};
