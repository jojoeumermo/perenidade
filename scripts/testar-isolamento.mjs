// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova as travas dos executores de código (lib/isolamento.ts e public/workers/isolar.js): o texto é o mesmo nos dois
// lugares, cada Worker de arquivo carrega a trava antes de tudo, cada Worker montado na hora começa por ela, e, num
// global de mentira com a mesma forma do de um Worker, o canal da sessão, o IndexedDB, os caches e a criação de outro
// Worker ficam fechados sem jeito de reabrir. Sem navegador e sem rede. Uso: npm run testar:isolamento
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

let certos = 0;
const falhas = [];
function espera(nome, conferir) {
  try {
    if (!conferir()) throw new Error("resultado inesperado");
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const fonte = readFileSync("lib/isolamento.ts", "utf8");
const trava = /export const ISOLAR_WORKER = `([\s\S]*?)`;/.exec(fonte)?.[1] ?? "";
const arquivo = readFileSync("public/workers/isolar.js", "utf8");
const semCabecalho = arquivo.split("\n").filter((linha, i, todas) => !(linha.startsWith("//") && todas.slice(0, i).every((l) => l.startsWith("//")))).join("\n");

espera("o texto da trava existe", () => trava.includes("BroadcastChannel") && trava.includes("indexedDB"));
espera("public/workers/isolar.js tem o mesmo texto de lib/isolamento.ts", () => semCabecalho === trava);

// Cada Worker de arquivo carrega a trava antes de qualquer outro código.
const pasta = "public/workers";
for (const nome of readdirSync(pasta).filter((n) => /\.(m?js)$/.test(n) && n !== "isolar.js")) {
  const codigo = readFileSync(join(pasta, nome), "utf8").split("\n").filter((l) => l.trim() && !l.trim().startsWith("//"));
  espera(`${nome} começa pela trava`, () => /^(importScripts\("\/workers\/isolar\.js"\);|import "\/workers\/isolar\.js";)$/.test(codigo[0]?.trim() ?? ""));
}

// Cada Worker montado na hora (Blob de JavaScript) começa pela trava.
function arquivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivos(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}
for (const caminho of [...arquivos("components"), ...arquivos("lib")]) {
  const texto = readFileSync(caminho, "utf8");
  if (!/new Worker\(URL\.createObjectURL/.test(texto)) continue;
  espera(`${caminho}: o Worker montado na hora começa pela trava`, () => (texto.match(/= `\$\{ISOLAR_WORKER\}/g) ?? []).length >= (texto.match(/new Worker\(URL\.createObjectURL/g) ?? []).length);
}

// Um global com a forma do de um Worker: atributos no próprio global e no protótipo, construtores como dados.
function globalDeWorker() {
  class Escopo {}
  const aberto = (nome) => ({ get: () => `aberto:${nome}`, configurable: true, enumerable: true });
  Object.defineProperty(Escopo.prototype, "indexedDB", aberto("indexedDB"));
  Object.defineProperty(Escopo.prototype, "caches", aberto("caches"));
  const g = new Escopo();
  Object.defineProperty(g, "indexedDB", aberto("indexedDB"));
  for (const nome of ["BroadcastChannel", "Worker"]) Object.defineProperty(g, nome, { value: function Construtor() {}, writable: true, configurable: true });
  g.self = g;
  return { g, Escopo };
}
const { g, Escopo } = globalDeWorker();
// A trava só usa "self" e Object: roda aqui mesmo, com "self" apontando para o global de mentira.
new Function("self", trava)(g);
const ler = (ler) => {
  try {
    return ler(g);
  } catch (erro) {
    return `erro:${erro.message}`;
  }
};

espera("BroadcastChannel fechado", () => ler((self) => self.BroadcastChannel) === undefined);
espera("indexedDB fechado", () => ler((self) => self.indexedDB) === undefined);
espera("caches fechado", () => ler((self) => self.caches) === undefined);
espera("Worker e SharedWorker fechados", () => ler((self) => self.Worker) === undefined && ler((self) => self.SharedWorker) === undefined);
espera("o getter do protótipo também está fechado", () => Object.getOwnPropertyDescriptor(Escopo.prototype, "indexedDB").get.call(g) === undefined && Object.getOwnPropertyDescriptor(Escopo.prototype, "caches").get.call(g) === undefined);
espera("não dá para reabrir trocando a propriedade", () => String(ler((self) => (Object.defineProperty(self, "BroadcastChannel", { value: 1 }), self.BroadcastChannel))).startsWith("erro:"));
espera("não dá para reabrir pelo protótipo", () => String(ler(() => Object.defineProperty(Escopo.prototype, "indexedDB", { get: () => 1 }))).startsWith("erro:"));
espera("não dá para reabrir por atribuição", () => ler((self) => ((self.indexedDB = 1), self.indexedDB)) === undefined);
espera("não dá para apagar", () => String(ler((self) => (delete self.Worker, self.Worker))).startsWith("erro:") && g.Worker === undefined && Object.getOwnPropertyDescriptor(g, "Worker").configurable === false);
espera("o resto do global continua de pé", () => ler((self) => self.self) === g);

console.log(`${certos} conferências certas, ${falhas.length} com problema.`);
for (const falha of falhas) console.log("  ✗", falha);
process.exit(falhas.length ? 1 : 0);
