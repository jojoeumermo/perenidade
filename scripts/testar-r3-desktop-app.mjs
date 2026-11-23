// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, itens 1.2, 2.3 e 2.4 no app do COMPUTADOR, com o executável de verdade aberto (Windows; o macOS e o Linux ficam pelo CI):
//   - a janela só tem a casca empacotada (http://tauri.localhost) e não navega para fora, não abre janela nova, não carrega script de
//     fora;
//   - a lista de comandos é fechada NA PRÁTICA: os comandos dos plugins (notificação, abrir no navegador) e um comando inventado são
//     recusados pelo próprio Tauri, mesmo chamados pela casca;
//   - o fetch nativo recusa caminho, método e servidor fora da lista antes de sair qualquer pedido;
//   - o cofre embrulha pela chave do chaveiro do sistema (Credential Manager), outra finalidade e um byte mexido não abrem;
//   - "um binário fora do log é recusado" no app que está rodando: este executável (montado aqui, nunca registrado) se confere contra
//     o lançamento da versão dele e dá "fora_do_log"; a instalação da mesma versão também é recusada e o app continua aberto;
//   - uma instância só: a segunda abertura sai e não cria janela;
//   - o chat funciona no computador: Ana no app (o motor de cifra EMPACOTADO, sem baixar nada), Bia no Node, nos dois sentidos, e a
//     mesma mensagem de novo não abre;
//   - "apagar tudo" fecha o app e apaga a chave do cofre: aberto de novo, o que foi embrulhado antes não abre mais.
// Precisa do executável montado com a casca de TESTE (a que expõe window.__alumiaTeste; a de lançamento não tem):
//   NEXT_PUBLIC_CASCA_TESTE=1 node casca/montar.mjs          (gera casca/saida)
//   cd desktop/src-tauri && npx tauri build --ci --no-bundle -- --locked
// Uso: node --experimental-wasm-jspi --experimental-wasm-exnref --import ./scripts/carregar-ts.mjs scripts/testar-r3-desktop-app.mjs <alumia.exe>
// O teste abre o app com a depuração do WebView2 numa porta local (variável de ambiente só deste processo) e mexe no chaveiro do
// usuário: cria a chave do cofre do app e, no fim, apaga (pelo próprio "apagar tudo"). APAGA os dados do app neste usuário do Windows:
// não rode numa máquina com o app da Alumia em uso de verdade.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { motorNoNode } from "./cifra-no-node.mjs";
import { cifrar, decifrar, ligarProteus, sessaoPelaPreChave } from "../lib/rede/chat/r2/proteus.ts";
import { novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";

const EXE = path.resolve(process.argv[2] ?? process.env.ALUMIA_EXE ?? "desktop/src-tauri/target/release/alumia.exe");
const PORTA = Number(process.env.ALUMIA_PORTA_DEPURAR ?? 9342);
const VERSAO = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, "../desktop/src-tauri/tauri.conf.json"), "utf8")).version;
const CASCA = /^http:\/\/tauri\.localhost\//;
if (process.platform !== "win32") {
  console.error("este teste abre o executável do Windows; no macOS e no Linux o CI monta e roda os testes do Rust");
  process.exit(2);
}
if (!fs.existsSync(EXE)) {
  console.error(`executável não encontrado: ${EXE}`);
  process.exit(2);
}

let certos = 0;
const falhas = [];
const naoConferido = [];
const ok = (nome, cond, detalhe = "") => {
  if (cond) {
    certos++;
    console.log(`ok - ${nome}`);
  } else {
    falhas.push(nome);
    console.log(`FALHOU - ${nome}${detalhe ? ` (${String(detalhe).slice(0, 400)})` : ""}`);
  }
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const b64 = (b) => Buffer.from(b).toString("base64");
const deB64 = (t) => Uint8Array.from(Buffer.from(t, "base64"));

function abrirApp() {
  const env = { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORTA}` };
  const p = spawn(EXE, [], { env, stdio: "ignore" });
  const saiu = new Promise((r) => p.once("exit", (codigo) => r(codigo)));
  return { p, saiu };
}

async function alvos() {
  return fetch(`http://127.0.0.1:${PORTA}/json/list`).then((r) => r.json()).catch(() => null);
}

/** Liga ao WebView2 do app e devolve a página da casca, já com a casca de teste pronta. */
async function ligar() {
  let navegador = null;
  for (let i = 0; i < 60 && !navegador; i++) {
    await esperar(500);
    navegador = await chromium.connectOverCDP(`http://127.0.0.1:${PORTA}`).catch(() => null);
  }
  if (!navegador) throw new Error("sem depuração do WebView2");
  const contexto = navegador.contexts()[0];
  let pagina = null;
  for (let i = 0; i < 60; i++) {
    pagina = contexto.pages().find((p) => CASCA.test(p.url())) ?? null;
    if (pagina && (await pagina.evaluate("typeof window.__alumiaTeste === 'object'").catch(() => false))) break;
    await esperar(500);
  }
  if (!pagina) throw new Error("a casca não abriu");
  return { navegador, contexto, pagina };
}

/** Os nomes guardados no sistema de arquivos privado da página, até dois níveis (o motor do chat guarda o banco dele em
 * "core-crypto/<nome>"). */
const LISTAR_ARQUIVOS =
  "navigator.storage.getDirectory().then(async (d) => { const n = []; for await (const [k, h] of d.entries()) { n.push(k); if (h.kind === 'directory') for await (const j of h.keys()) n.push(k + '/' + j); } return n; })";
const LIMPAR_BANCO_DE_TESTE =
  "navigator.storage.getDirectory().then(async (d) => { for await (const [, h] of d.entries()) if (h.kind === 'directory') for await (const j of h.keys()) if (j.startsWith('alumia-teste-aparelho')) await h.removeEntry(j, { recursive: true }); })";

const invocar = (pagina, comando, args = {}) =>
  pagina.evaluate(
    ([c, a]) =>
      window.__TAURI_INTERNALS__.invoke(c, a).then(
        (v) => ({ ok: true, v }),
        (e) => ({ ok: false, e: String(e) }),
      ),
    [comando, args],
  );

// ── 0. O que o teste precisa de fora: o GitHub responde 404 para o lançamento desta versão (que nunca foi publicado) ──
const enderecoDoPacote = `https://github.com/jojoeumermo/perenidade/releases/download/v${VERSAO}/alumia-${VERSAO}-windows-x64-executavel.exe.sigstore.json`;
const statusDoGithub = await fetch(enderecoDoPacote, { method: "HEAD", redirect: "manual" }).then((r) => r.status).catch(() => 0);
console.log(`# executável: ${EXE}\n# versão ${VERSAO}; o GitHub responde ${statusDoGithub || "nada"} para o pacote desta versão`);

// ── 1. A janela e a casca ──
console.log("# janela e casca");
let app = abrirApp();
let { navegador, contexto, pagina } = await ligar();
const consoleDaCasca = [];
pagina.on("console", (m) => consoleDaCasca.push(`${m.type()}: ${m.text()}`));
const paginas = ((await alvos()) ?? []).filter((a) => a.type === "page");
ok("uma janela só, e ela é a casca empacotada", paginas.length === 1 && CASCA.test(paginas[0].url), JSON.stringify(paginas.map((a) => a.url)));
ok("a casca de teste está montada (o pacote de lançamento não a tem)", await pagina.evaluate("typeof window.__alumiaTeste.chatComecar === 'function'"));

await pagina.evaluate("(location.href = 'https://example.org/', true)").catch(() => undefined);
await esperar(2500);
ok("ataque: a casca não navega para fora (on_navigation recusa)", CASCA.test(pagina.url()), pagina.url());
await pagina.evaluate("window.open('https://example.org/', '_blank')").catch(() => undefined);
await esperar(2500);
const depoisDaJanela = ((await alvos()) ?? []).filter((a) => a.type === "page");
ok("ataque: a casca não abre janela nova (on_new_window recusa)", depoisDaJanela.length === 1 && !depoisDaJanela.some((a) => a.url.includes("example.org")), JSON.stringify(depoisDaJanela.map((a) => a.url)));
const injetado = await pagina.evaluate(
  "new Promise((ok) => { const s = document.createElement('script'); s.src = 'https://example.org/x.js'; s.onerror = () => ok('recusado'); s.onload = () => ok('carregou'); document.head.appendChild(s); setTimeout(() => ok('tempo'), 8000); })",
);
ok("ataque: script de fora injetado na casca não carrega (CSP)", injetado !== "carregou", injetado);
const scriptsDeFora = await pagina.evaluate("[...document.scripts].filter((s) => s.src && !/^http:\\/\\/tauri\\.localhost\\//.test(s.src) && !s.src.includes('example.org')).length");
ok("nenhum script de fora na casca", scriptsDeFora === 0);

// ── 2. A lista fechada, na prática ──
console.log("# comandos");
for (const [comando, args] of [
  ["plugin:notification|notify", { options: { title: "x", body: "texto da conversa" } }],
  ["plugin:notification|request_permission", {}],
  ["plugin:opener|open_url", { url: "https://example.org/" }],
  ["plugin:opener|open_path", { path: "C:\\Windows\\System32\\calc.exe" }],
  ["plugin:single-instance|x", {}],
  ["plugin:event|listen", { event: "x", target: { kind: "Any" }, handler: 1 }],
  ["plugin:window|close", { label: "principal" }],
  ["plugin:webview|print", {}],
  ["comando_inventado", {}],
]) {
  const r = await invocar(pagina, comando, args);
  ok(`ataque: '${comando}' é recusado pelo Tauri`, !r.ok, JSON.stringify(r));
}
for (const [nome, args] of [
  ["caminho fora dos serviços do chat", { metodo: "GET", caminho: "/api/rede/perfil", cabecalhos: [], corpo: null }],
  ["outro servidor pelo caminho", { metodo: "GET", caminho: "//mal.example/api/alumia/porta", cabecalhos: [], corpo: null }],
  ["subida de pasta", { metodo: "GET", caminho: "/api/alumia/porta/../../rede/perfil", cabecalhos: [], corpo: null }],
  ["método fora da lista", { metodo: "DELETE", caminho: "/api/alumia/caixa", cabecalhos: [], corpo: null }],
  ["cabeçalho fora da lista", { metodo: "GET", caminho: "/api/alumia/porta", cabecalhos: [["cookie", "sb=1"]], corpo: null }],
]) {
  const r = await invocar(pagina, "rede_pedir", args);
  ok(`ataque: fetch nativo recusa ${nome}`, !r.ok, JSON.stringify(r));
}

// ── 3. O cofre pelo chaveiro do sistema ──
console.log("# cofre");
const segredo = b64(new TextEncoder().encode("chave do banco do chat"));
const embrulho = await invocar(pagina, "cofre_embrulhar", { finalidade: "chat-banco", dados: segredo });
ok("o cofre embrulha (chave no Credential Manager)", embrulho.ok && typeof embrulho.v === "string" && embrulho.v !== segredo, JSON.stringify(embrulho));
const volta = await invocar(pagina, "cofre_desembrulhar", { finalidade: "chat-banco", embrulhado: embrulho.v });
ok("o cofre desembrulha o que embrulhou", volta.ok && volta.v === segredo, JSON.stringify(volta));
const outra = await invocar(pagina, "cofre_desembrulhar", { finalidade: "outra-coisa", embrulhado: embrulho.v });
ok("ataque: outra finalidade não abre", outra.ok && outra.v === null, JSON.stringify(outra));
const mexido = deB64(embrulho.v);
mexido[mexido.length - 1] ^= 1;
const aberto = await invocar(pagina, "cofre_desembrulhar", { finalidade: "chat-banco", embrulhado: b64(mexido) });
ok("ataque: um byte mexido não abre", aberto.ok && aberto.v === null, JSON.stringify(aberto));

// ── 4. O binário fora do log, no app que está rodando ──
console.log("# atualização");
if (statusDoGithub === 404) {
  const proprio = await invocar(pagina, "atualizacao_conferir", { versao: VERSAO });
  ok(`aceite: este executável (nunca registrado) se confere e dá fora_do_log`, proprio.ok && proprio.v === "fora_do_log", JSON.stringify(proprio));
  const instalar = await invocar(pagina, "atualizacao_instalar", { versao: VERSAO });
  ok("aceite: a instalação de uma versão fora do log é recusada", instalar.ok && instalar.v === "fora_do_log", JSON.stringify(instalar));
  await esperar(1000);
  ok("o app continua aberto depois da recusa (nada foi gravado nem aberto)", app.p.exitCode === null);
} else {
  naoConferido.push(`a conferência contra o GitHub (respondeu ${statusDoGithub || "nada"}, não 404)`);
}
const mentira = await invocar(pagina, "atualizacao_conferir", { versao: "9.9.9" });
ok("ataque: a casca dizer outra versão não muda nada (vale a compilada): fora_do_log", mentira.ok && mentira.v === "fora_do_log", JSON.stringify(mentira));
for (const v of ["1.0", "../../x", "latest"]) {
  const r = await invocar(pagina, "atualizacao_instalar", { versao: v });
  ok(`ataque: versão '${v}' fora do formato nem baixa`, r.ok && r.v === "fora_do_log", JSON.stringify(r));
}

// ── 5. Uma instância só ──
console.log("# uma instância");
const segunda = spawn(EXE, [], { stdio: "ignore" });
const saiuASegunda = await Promise.race([new Promise((r) => segunda.once("exit", () => r(true))), esperar(15_000).then(() => false)]);
if (!saiuASegunda) segunda.kill();
const depoisDaSegunda = ((await alvos()) ?? []).filter((a) => a.type === "page");
ok("a segunda abertura sai sozinha e não cria janela", saiuASegunda && depoisDaSegunda.length === 1, JSON.stringify(depoisDaSegunda.map((a) => a.url)));

// ── 6. Notificação ──
const notificou = await invocar(pagina, "notificar");
ok("notificar não recebe texto da página e responde", notificou.ok, JSON.stringify(notificou));

// ── 7. O chat: Ana no app, Bia no Node ──
console.log("# chat");
const comJspi = await pagina.evaluate("typeof WebAssembly.Suspending === 'function'");
const versaoDoWebView = navegador.version() || "?";
console.log(`  WebView2 ${versaoDoWebView}; JSPI: ${comJspi ? "sim" : "não"}`);
const pedidosDeFora = [];
contexto.on("request", (r) => {
  if (!CASCA.test(r.url()) && !r.url().startsWith("data:") && !r.url().startsWith("blob:") && !/ipc\.localhost/.test(r.url())) pedidosDeFora.push(r.url());
});
if (comJspi) {
  const M = await motorNoNode();
  const bia = { motor: await M.CoreCrypto.new(M.Database.inMemory()), chave: novoParEd25519() };
  bia.impressao = await ligarProteus(bia.motor);
  // A casca de teste abre sempre o mesmo banco (no sistema de arquivos privado da página) com uma chave nova: o de uma rodada
  // interrompida antes do "apagar tudo" não abriria ("file is not a database").
  await pagina.evaluate(LIMPAR_BANCO_DE_TESTE);
  const ana = await pagina.evaluate("window.__alumiaTeste.chatComecar()");
  ok("o motor de cifra roda dentro do app (core-crypto empacotado)", typeof ana?.impressao === "string" && ana.impressao.length > 20, JSON.stringify(ana));
  await sessaoPelaPreChave(bia.motor, deB64(ana.aparelho), ana.impressao, { id: ana.pre.id, pkb: deB64(ana.pre.pkb), assinatura: deB64(ana.pre.assinatura) });
  const ida = await cifrar(bia.motor, deB64(ana.aparelho), new TextEncoder().encode("oi, Ana — Bia no Node"));
  const abrir = (c) => pagina.evaluate(([a, i, x]) => window.__alumiaTeste.chatAbrir(a, i, x), [b64(bia.chave.publica), bia.impressao, b64(c)]);
  ok("o chat funciona: Ana (app do computador) abre o que Bia (Node) mandou", (await abrir(ida)) === "oi, Ana — Bia no Node");
  const resposta = await pagina.evaluate(([p, t]) => window.__alumiaTeste.chatCifrar(p, t), [b64(bia.chave.publica), "oi, Bia — Ana no computador"]);
  const abertoPelaBia = await decifrar(bia.motor, deB64(ana.aparelho), ana.impressao, deB64(resposta));
  ok("o chat funciona: Bia (Node) abre o que Ana (app do computador) mandou", abertoPelaBia && new TextDecoder().decode(abertoPelaBia) === "oi, Bia — Ana no computador");
  ok("ataque: a mesma mensagem de novo não abre (repetição)", (await abrir(ida)) === null);
  ok("o motor do chat não veio de fora (nenhum pedido fora da casca)", pedidosDeFora.length === 0, JSON.stringify(pedidosDeFora));
  const arquivosAntes = await pagina.evaluate(LISTAR_ARQUIVOS).catch(() => []);
  ok("o banco do chat existe antes de apagar (controle da conferência depois)", arquivosAntes.some((k) => k.includes("alumia-teste-aparelho")), JSON.stringify(arquivosAntes));
} else {
  naoConferido.push(`o chat no app: o WebView2 (${versaoDoWebView}) não tem JSPI`);
}
const avisosDeCsp = consoleDaCasca.filter((l) => /Content Security Policy|Refused to connect/i.test(l));
// Só o script de fora injetado acima pode ser recusado; qualquer outra recusa (a ponte do Tauri, o WebAssembly do motor) é defeito.
const recusasInesperadas = avisosDeCsp.filter((l) => !l.includes("example.org"));
ok("a CSP da casca só recusou o que o teste injetou de fora (a ponte e o motor passam)", recusasInesperadas.length === 0, recusasInesperadas.join(" | "));

// ── 8. Apagar tudo ──
console.log("# apagar tudo");
await invocar(pagina, "app_apagar_tudo").catch(() => undefined);
const fechou = await Promise.race([app.saiu.then(() => true), esperar(15_000).then(() => false)]);
ok("apagar tudo fecha o app", fechou);
await navegador.close().catch(() => undefined);
if (!fechou) app.p.kill();
await esperar(1500);
// Com o WebView aberto, o Windows não deixa apagar o perfil dele: o app deixa o marcador e a próxima abertura apaga antes do WebView.
const PASTA_DO_APP = path.join(process.env.LOCALAPPDATA ?? "", "org.institutolucia.alumia");
const MARCADOR = `${PASTA_DO_APP}.apagar`;
ok("apagar tudo deixa o marcador para a próxima abertura", fs.existsSync(MARCADOR));
const resto = path.join(PASTA_DO_APP, "EBWebView", "resto-do-teste.txt");
let plantado = false;
try {
  fs.mkdirSync(path.dirname(resto), { recursive: true });
  fs.writeFileSync(resto, "sobra");
  plantado = true;
} catch {
  /* a pasta pode ter sumido inteira: tanto melhor */
}
app = abrirApp();
({ navegador, pagina } = await ligar());
ok("a próxima abertura apaga o que sobrou do perfil antes de o WebView subir, e tira o marcador", (!plantado || !fs.existsSync(resto)) && !fs.existsSync(MARCADOR));
const depoisDeApagar = await invocar(pagina, "cofre_desembrulhar", { finalidade: "chat-banco", embrulhado: embrulho.v });
ok("depois de apagar tudo, o que foi embrulhado antes não abre (a chave do chaveiro sumiu)", depoisDeApagar.ok && depoisDeApagar.v === null, JSON.stringify(depoisDeApagar));
const arquivosDepois = await pagina.evaluate(LISTAR_ARQUIVOS).catch((e) => [String(e)]);
ok("e o banco do chat da página sumiu (sistema de arquivos privado vazio)", Array.isArray(arquivosDepois) && arquivosDepois.length === 0, JSON.stringify(arquivosDepois));
// Limpa o que este teste criou (a chave nova do chaveiro e os dados do app) pelo próprio app.
await invocar(pagina, "app_apagar_tudo").catch(() => undefined);
await Promise.race([app.saiu, esperar(15_000)]);
await navegador.close().catch(() => undefined);
if (app.p.exitCode === null) app.p.kill();
await esperar(3000);
// O esqueleto do perfil desta última abertura (e o marcador) são do teste: saem daqui, sem abrir o app de novo.
fs.rmSync(PASTA_DO_APP, { recursive: true, force: true, maxRetries: 5, retryDelay: 1000 });
fs.rmSync(MARCADOR, { force: true });

console.log(`\n${certos} certos, ${falhas.length} falhas${naoConferido.length ? `; NÃO CONFERIDO: ${naoConferido.join("; ")}` : ""}`);
process.exit(falhas.length ? 1 : 0);
