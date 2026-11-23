// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.2: o recurso "alumia-chat-so-app" (lib/rede/transparencia-apps/recurso.ts). Confere, sem navegador:
//   1. o portão só liga pelo nome (nunca com "todos", que é o que a produção usa) e "-nome" desliga;
//   2. o endereço do chat vira a página de baixar e conferir com o recurso ligado, e continua nas conversas com ele desligado;
//   3. o que as páginas do chat mostram com o recurso ligado (o aviso, a página do app) não importa, nem de longe, nenhum módulo de
//      chave do chat: o grafo de importações estáticas a partir dessas peças não chega a lib/rede/chat, lib/rede/cifra, lib/equipe,
//      lib/rede/grupos nem a nenhum arquivo com os marcadores do chat;
//   4. as páginas do chat decidem ANTES de carregar o chat (o painel importa as conversas só por import());
//   5. a lista de versões ignora o que vier fora do formato.
// A conferência no navegador de verdade (nenhum pedido a /cifra/* e nenhum JavaScript baixado com os marcadores) é e2e/so-app.spec.ts.
// Uso: npm run testar:r3-so-app
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { decidirChatSoApp, RECURSO_CHAT_SO_APP } from "../lib/rede/transparencia-apps/recurso.ts";
import { rotaNoChat } from "../lib/rede/chat/origem.ts";
import { lerVersoes, enderecoNoLancamento } from "../lib/rede/transparencia-apps/versoes.ts";
import { lerRecursos } from "../lib/recursos.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ler = (c) => fs.readFileSync(path.join(RAIZ, c), "utf8");
let n = 0;
const ok = async (nome, fn) => {
  await fn();
  n++;
  console.log(`ok ${n} - ${nome}`);
};

// ── 1. o portão ──
const fora = { noCatalogo: false, soPeloNome: false, ligadoPeloCatalogo: () => true };
await ok("fora do catálogo: só liga com o nome escrito; 'todos' e o vazio não ligam; '-nome' desliga", () => {
  assert.equal(decidirChatSoApp(lerRecursos(""), fora), false);
  assert.equal(decidirChatSoApp(lerRecursos("todos"), fora), false);
  assert.equal(decidirChatSoApp(lerRecursos("todos,rede-v2,alumia-2"), fora), false);
  assert.equal(decidirChatSoApp(lerRecursos(`todos,${RECURSO_CHAT_SO_APP}`), fora), true);
  assert.equal(decidirChatSoApp(lerRecursos(` ${RECURSO_CHAT_SO_APP.toUpperCase()} `), fora), true);
  assert.equal(decidirChatSoApp(lerRecursos(`${RECURSO_CHAT_SO_APP},-${RECURSO_CHAT_SO_APP}`), fora), false);
});
await ok("no catálogo: vale a decisão do catálogo só se estiver em SO_PELO_NOME (senão 'todos' o ligaria): falha fechada", () => {
  assert.equal(decidirChatSoApp(lerRecursos("todos"), { noCatalogo: true, soPeloNome: false, ligadoPeloCatalogo: () => true }), false);
  assert.equal(decidirChatSoApp(lerRecursos("todos"), { noCatalogo: true, soPeloNome: true, ligadoPeloCatalogo: () => false }), false);
  assert.equal(decidirChatSoApp(lerRecursos(RECURSO_CHAT_SO_APP), { noCatalogo: true, soPeloNome: true, ligadoPeloCatalogo: () => true }), true);
  assert.equal(decidirChatSoApp(lerRecursos(`-${RECURSO_CHAT_SO_APP}`), { noCatalogo: true, soPeloNome: true, ligadoPeloCatalogo: () => true }), false);
});
await ok("nesta montagem (sem a variável), o recurso está desligado", async () => {
  const { chatSoApp } = await import("../lib/rede/transparencia-apps/recurso.ts");
  if (!process.env.NEXT_PUBLIC_RECURSOS) assert.equal(chatSoApp(), false);
});

// ── 2. o endereço do chat ──
await ok("endereço do chat, recurso desligado: '/' e '/<idioma>' continuam nas conversas", () => {
  assert.deepEqual(rotaNoChat("/", false), { tipo: "reescrever", destino: "/pt/alumia/conversas" });
  assert.deepEqual(rotaNoChat("/en", false), { tipo: "reescrever", destino: "/en/alumia/conversas" });
});
await ok("endereço do chat, recurso ligado: '/' e '/<idioma>' viram a página de baixar e conferir", () => {
  assert.deepEqual(rotaNoChat("/", true), { tipo: "reescrever", destino: "/pt/alumia/app" });
  assert.deepEqual(rotaNoChat("/fr", true), { tipo: "reescrever", destino: "/fr/alumia/app" });
});
await ok("a página do app abre no endereço do chat; o resto continua como era", () => {
  assert.deepEqual(rotaNoChat("/pt/alumia/app", true), { tipo: "seguir" });
  assert.deepEqual(rotaNoChat("/pt/alumia/app", false), { tipo: "seguir" });
  assert.equal(rotaNoChat("/pt/alumia/app/outra", true).tipo, "site");
  assert.equal(rotaNoChat("/alumia/app", true).tipo, "site");
  assert.deepEqual(rotaNoChat("/pt/alumia/conversas", true), { tipo: "seguir" });
  assert.equal(rotaNoChat("/pt/aulas", true).tipo, "site");
});

// ── 3. o grafo de importações ──
const PROIBIDOS = [/^lib\/rede\/chat\//, /^lib\/rede\/cifra\//, /^lib\/equipe\//, /^lib\/rede\/grupos\//, /^lib\/rede\/chat-/, /^lib\/rede\/cliente-chat/, /^components\/rede\/chat\//, /^components\/painel\/Conversas/];
const MARCADORES = ["alumia/r2/envelope/v1", "proteusEncrypt", "spqr", "@wireapp/core-crypto", "matrix-sdk-crypto"];
const EXCECOES = new Set(["lib/rede/chat/origem.ts"]); // só a regra do endereço (sem cifra); o proxy usa
function resolver(de, esp) {
  let base;
  if (esp.startsWith("@/")) base = path.join(RAIZ, esp.slice(2));
  else if (esp.startsWith(".")) base = path.resolve(path.dirname(path.join(RAIZ, de)), esp);
  else return null; // pacote: o pacote do chat é pego pelos marcadores no arquivo que o importa
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts"), path.join(base, "index.tsx")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(RAIZ, c).split(path.sep).join("/");
  }
  return null;
}
function estaticos(arquivo) {
  const texto = ler(arquivo).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const saida = [];
  for (const m of texto.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\b)(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g)) saida.push(m[1]);
  return saida;
}
function grafo(inicio) {
  const vistos = new Set();
  const fila = [...inicio];
  while (fila.length) {
    const a = fila.pop();
    if (vistos.has(a)) continue;
    vistos.add(a);
    if (!/\.(ts|tsx|mjs|js)$/.test(a)) continue;
    for (const esp of estaticos(a)) {
      const r = resolver(a, esp);
      if (r) fila.push(r);
    }
  }
  return vistos;
}
await ok("o aviso e a página do app não alcançam nenhum módulo de chave do chat (importações estáticas, transitivas)", () => {
  const alcancados = grafo([
    "components/rede/transparencia-apps/ChatSoNoApp.tsx",
    "components/rede/transparencia-apps/ChatSoNoAppNoPainel.tsx",
    "app/[lang]/alumia/app/page.tsx",
    "lib/rede/transparencia-apps/recurso.ts",
  ]);
  assert.ok(alcancados.size > 5, "o grafo andou");
  for (const a of alcancados) {
    if (EXCECOES.has(a)) continue;
    for (const p of PROIBIDOS) assert.ok(!p.test(a), `alcança ${a}`);
    if (/\.(ts|tsx)$/.test(a)) for (const m of MARCADORES) assert.ok(!ler(a).includes(m), `${a} tem o marcador ${m}`);
  }
});
await ok("o teste do grafo pega quem importa o chat (controle: a tela do chat alcança o cliente do chat)", () => {
  const alcancados = grafo(["components/rede/chat/Tela.tsx"]);
  assert.ok([...alcancados].some((a) => PROIBIDOS.some((p) => p.test(a)) && a !== "components/rede/chat/Tela.tsx"));
});

// ── 4. as páginas decidem antes de carregar o chat ──
await ok("/alumia/conversas: o aviso sai antes da Rede (e do chat) ser carregada", () => {
  const p = ler("app/[lang]/alumia/conversas/page.tsx");
  assert.ok(p.indexOf("if (chatSoApp())") > 0 && p.indexOf("if (chatSoApp())") < p.indexOf("<RedeSobDemanda"));
});
await ok("/alumia/aparelhos: o aviso sai antes da página nova (a lista de aparelhos do chat)", () => {
  const p = ler("app/[lang]/alumia/aparelhos/page.tsx");
  assert.ok(p.indexOf("chatSoApp()") > 0 && p.indexOf("chatSoApp()") < p.lastIndexOf("<PaginaNova"));
});
await ok("o painel importa as conversas da equipe só por import(), e com o recurso ligado mostra o aviso", () => {
  const d = ler("components/painel/casca/Dentro.tsx");
  assert.ok(!/import\s*\{\s*Conversas\s*\}\s*from/.test(d), "nada de importação estática das conversas");
  assert.match(d, /const Conversas = dynamic\(\(\) => import\("\.\.\/Conversas"\)/);
  assert.match(d, /atual\.id === "conversas" && \(CHAT_SO_APP \? <ChatSoNoAppNoPainel \/> : <Conversas me=\{eu\} \/>\)/);
  assert.match(d, /atual\.id === "reunioes" && \(CHAT_SO_APP \?/);
});
await ok("a página do app abre sem conta (LIVRES do portão da Alumia)", () => {
  assert.match(ler("components/rede/entrada/PortaoDaAlumia.tsx"), /modo-ato\\\/sem-sinal\|app\)/);
});

// ── 5. a lista de versões ──
const bom = { nome: "alumia-1.0.0-windows-x64-setup.exe", plataforma: "windows", sha256: "a".repeat(64), tamanho: 10, rekor: { indice: 1, uuid: "b".repeat(80) }, pacote: "alumia-1.0.0-windows-x64-setup.exe.sigstore.json" };
await ok("versoes.json: o publicado hoje é 'nenhuma versão'; o que vier fora do formato some", () => {
  assert.deepEqual(lerVersoes(JSON.parse(ler("public/apps/versoes.json"))), { versao: null, arquivos: [] });
  assert.deepEqual(lerVersoes({ versao: "1.0.0", arquivos: [bom] }).arquivos.length, 1);
  for (const ruim of [
    { ...bom, nome: "../x" }, { ...bom, nome: "a b" }, { ...bom, plataforma: "ios" }, { ...bom, sha256: "A".repeat(64) }, { ...bom, tamanho: -1 },
    { ...bom, rekor: { indice: 1, uuid: "x" } }, { ...bom, pacote: "<script>" }, null, "x",
  ]) assert.equal(lerVersoes({ versao: "1.0.0", arquivos: [ruim] }).arquivos.length, 0, JSON.stringify(ruim));
  assert.deepEqual(lerVersoes({ versao: "1.0.0-rc", arquivos: [bom] }), { versao: null, arquivos: [] });
  assert.equal(enderecoNoLancamento("1.0.0", bom.nome), "https://github.com/jojoeumermo/perenidade/releases/download/v1.0.0/alumia-1.0.0-windows-x64-setup.exe");
});

console.log(`\n${n} testes, todos passaram.`);
