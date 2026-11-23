// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa a dois da onda R2 no NAVEGADOR (Edge sem janela, pelo Playwright), no que só lá dá para provar:
//   - zerar o beta: um aparelho com as lojas do chat velho (chat a dois, histórico, grupos, biblioteca do Matrix, chaves no
//     localStorage) fica sem nenhuma delas depois da primeira abertura, e a limpeza não roda de novo (lib/rede/chat/r2/limpeza.ts);
//   - a loja selada (lib/rede/chat/r2/loja.ts): o que vai ao IndexedDB não tem o texto em claro, a chave não sai (não exportável), e o
//     estado de uma conta não abre como de outra;
//   - o "Sair rápido" (lib/rede/chat/gaveta.ts) apaga a loja nova e a loja do motor no OPFS;
//   - onda R3: o SPQR (lib/rede/chat/r3/spqr.ts) carrega do caminho do site, com uma CSP como a do site (script-src 'self'
//     'wasm-unsafe-eval', sem 'unsafe-eval'), confere o sha256 e troca chaves; o arquivo adulterado é recusado.
// Os arquivos TypeScript vão ao navegador transpilados pelo próprio TypeScript, sem empacotador. O servidor de teste serve só eles e
// uma página em branco, em 127.0.0.1 com porta sorteada, e é desligado no fim.
// Uso: node scripts/testar-r2-dupla-navegador.mjs
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const transpilar = (arquivo) =>
  ts
    .transpileModule(fs.readFileSync(path.join(raiz, arquivo), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } })
    .outputText.replace(/from "\.\/loja"/g, 'from "/loja.js"');
const arquivos = {
  "/loja.js": transpilar("lib/rede/chat/r2/loja.ts"),
  "/limpeza.js": transpilar("lib/rede/chat/r2/limpeza.ts"),
  "/gaveta.js": transpilar("lib/rede/chat/gaveta.ts"),
  "/spqr.js": transpilar("lib/rede/chat/r3/spqr.ts"),
};
const wasmDoSpqr = fs.readFileSync(path.join(raiz, "nativo/spqr-wasm/spqr-1.7.0.wasm"));
const wasmAdulterado = Buffer.from(wasmDoSpqr);
wasmAdulterado[wasmAdulterado.length - 1] ^= 1;
const binarios = { "/cifra/spqr-1.7.0.wasm": wasmDoSpqr, "/cifra/spqr-adulterado.wasm": wasmAdulterado };
// A página do teste do SPQR leva uma CSP como a do site (next.config.ts): o WebAssembly compila com 'wasm-unsafe-eval', sem 'unsafe-eval'.
const CSP_DO_SPQR = "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; connect-src 'self'";
const servidor = http.createServer((pedido, resposta) => {
  const binario = binarios[pedido.url];
  if (binario) {
    resposta.writeHead(200, { "content-type": "application/wasm" });
    resposta.end(binario);
    return;
  }
  if (pedido.url === "/spqr.html") {
    resposta.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-security-policy": CSP_DO_SPQR });
    resposta.end("<!doctype html><title>spqr</title>");
    return;
  }
  const js = arquivos[pedido.url];
  resposta.writeHead(200, { "content-type": js ? "text/javascript" : "text/html; charset=utf-8" });
  resposta.end(js ?? "<!doctype html><title>teste</title>");
});
await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
const origem = `http://127.0.0.1:${servidor.address().port}`;

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

const navegador = await chromium.launch({ channel: "msedge" });
try {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.goto(origem);

  // ── Zerar o beta ──
  const antes = await pagina.evaluate(async () => {
    const criar = (nome) => new Promise((ok) => { const p = indexedDB.open(nome, 1); p.onupgradeneeded = () => p.result.createObjectStore("x"); p.onsuccess = () => { p.result.close(); ok(); }; });
    for (const n of ["lucia-alumia-chat", "lucia-alumia-historico", "lucia-alumia-grupos", "lucia-alumia-olm-conta::matrix-sdk-crypto", "lucia-equipe-olm-conta::matrix-sdk-crypto-meta", "lucia-busca"]) await criar(n);
    localStorage.setItem("lucia-alumia-chat-rascunho", "texto do beta");
    localStorage.setItem("outra-coisa", "fica");
    return (await indexedDB.databases()).map((b) => b.name).sort();
  });
  confere("beta: o aparelho começa com as lojas do chat velho", antes.includes("lucia-alumia-chat") && antes.includes("lucia-alumia-olm-conta::matrix-sdk-crypto"));
  const limpou = await pagina.evaluate(async () => (await import("/limpeza.js")).limparChatAntigo());
  confere("beta: a primeira abertura limpa", limpou === true);
  const depois = await pagina.evaluate(async () => ({ bancos: (await indexedDB.databases()).map((b) => b.name).sort(), rascunho: localStorage.getItem("lucia-alumia-chat-rascunho"), outra: localStorage.getItem("outra-coisa") }));
  confere("beta: nenhuma loja do chat velho sobra no aparelho", !depois.bancos.some((n) => /^lucia-(alumia-(chat|historico|grupos|olm-)|equipe-olm-)/.test(n)), JSON.stringify(depois.bancos));
  confere("beta: o que não é do chat fica", depois.bancos.includes("lucia-busca") && depois.outra === "fica");
  confere("beta: as chaves do chat velho no localStorage somem", depois.rascunho === null);
  confere("beta: a limpeza não roda de novo (o histórico novo não é apagado na segunda abertura)", (await pagina.evaluate(async () => (await import("/limpeza.js")).limparChatAntigo())) === false);

  // ── A loja selada ──
  const loja = await pagina.evaluate(async () => {
    const l = await import("/loja.js");
    await l.gravarNaLoja("conta-a", { identidade: "SEGREDO-DA-CONTA-A" });
    const lido = await l.lerDaLoja("conta-a");
    const bruto = await new Promise((ok) => {
      const p = indexedDB.open(l.BANCO_R2);
      p.onsuccess = () => {
        const tx = p.result.transaction(["estados", "chaves"], "readonly");
        const e = tx.objectStore("estados").get("conta-a");
        const k = tx.objectStore("chaves").get("selo");
        tx.oncomplete = () => { p.result.close(); ok({ estado: e.result, chave: k.result }); };
      };
    });
    const texto = new TextDecoder("latin1").decode(new Uint8Array(bruto.estado.cifrado));
    let exportou = true;
    try {
      await crypto.subtle.exportKey("raw", bruto.chave);
    } catch {
      exportou = false;
    }
    // O estado da conta A copiado para o lugar da conta B: o dado associado não confere.
    await new Promise((ok) => {
      const p = indexedDB.open(l.BANCO_R2);
      p.onsuccess = () => { const tx = p.result.transaction("estados", "readwrite"); tx.objectStore("estados").put(bruto.estado, "conta-b"); tx.oncomplete = () => { p.result.close(); ok(); }; };
    });
    const trocado = await l.lerDaLoja("conta-b");
    // Duas gravações do mesmo estado: IV diferente.
    await l.gravarNaLoja("conta-a", { identidade: "SEGREDO-DA-CONTA-A" });
    const segundo = await new Promise((ok) => { const p = indexedDB.open(l.BANCO_R2); p.onsuccess = () => { const g = p.result.transaction("estados").objectStore("estados").get("conta-a"); g.onsuccess = () => { p.result.close(); ok(g.result); }; }; });
    return { lido, claro: texto.includes("SEGREDO"), extraivel: bruto.chave.extractable, exportou, trocado, ivIgual: [...bruto.estado.iv].join() === [...segundo.iv].join() };
  });
  confere("loja: o estado volta inteiro", loja.lido?.identidade === "SEGREDO-DA-CONTA-A");
  confere("loja: no IndexedDB não há texto em claro", loja.claro === false);
  confere("loja: a chave da loja não é exportável", loja.extraivel === false && loja.exportou === false);
  confere("loja: o estado de uma conta não abre como de outra", loja.trocado === null);
  confere("loja: cada gravação sorteia um IV novo", loja.ivIgual === false);

  // ── Sair rápido: a loja nova e o motor no OPFS somem ──
  const sair = await pagina.evaluate(async () => {
    const raiz = await navigator.storage.getDirectory();
    const pasta = await raiz.getDirectoryHandle("core-crypto", { create: true });
    const loja = await pasta.getDirectoryHandle("alumia-r2-conta-a", { create: true });
    const w = await (await loja.getFileHandle("sessoes", { create: true })).createWritable();
    await w.write("estado do motor");
    await w.close();
    await (await import("/gaveta.js")).apagarTudoDoChat();
    await new Promise((r) => setTimeout(r, 300));
    const nomes = [];
    for await (const [n] of pasta.entries()) nomes.push(n);
    return { bancos: (await indexedDB.databases()).map((b) => b.name), opfs: nomes };
  });
  confere("sair rápido: a loja do chat novo some", !sair.bancos.includes("lucia-alumia-r2"), JSON.stringify(sair.bancos));
  confere("sair rápido: a loja do motor no OPFS some", !sair.opfs.includes("alumia-r2-conta-a"), JSON.stringify(sair.opfs));

  // ── Onda R3: o SPQR no navegador, com a CSP do site ──
  const paginaSpqr = await (await navegador.newContext()).newPage();
  await paginaSpqr.goto(`${origem}/spqr.html`);
  const spqr = await paginaSpqr.evaluate(async () => {
    const m = await import("/spqr.js");
    // Primeiro o adulterado (o carregamento fica guardado por página: o certo depois não é trocado por ele).
    let adulterado = "aceitou";
    try {
      await m.carregarSpqr("/cifra/spqr-adulterado.wasm");
    } catch (e) {
      adulterado = e.message;
    }
    const motor = await m.carregarSpqr();
    const auth = crypto.getRandomValues(new Uint8Array(32));
    let a = motor.inicial("A2B", auth);
    let b = motor.inicial("B2A", auth);
    let iguais = 0;
    let total = 0;
    for (let volta = 0; volta < 30; volta++) {
      for (const [de, para] of [["a", "b"], ["b", "a"]]) {
        const env = motor.enviar(de === "a" ? a : b);
        if (de === "a") a = env.estado; else b = env.estado;
        const rec = motor.receber(para === "a" ? a : b, env.msg);
        if (!rec) continue;
        if (para === "a") a = rec.estado; else b = rec.estado;
        total++;
        if (env.chave.length === 32 && rec.chave.length === 32 && env.chave.every((x, i) => x === rec.chave[i])) iguais++;
      }
    }
    return { iguais, total, adulterado };
  });
  confere("SPQR no navegador (CSP do site): carrega do caminho do site e 60 mensagens dão as mesmas chaves dos dois lados", spqr.total === 60 && spqr.iguais === 60, JSON.stringify(spqr));
  confere("SPQR no navegador: o WebAssembly adulterado (um byte) é recusado pelo sha256", spqr.adulterado === "spqr_resumo", spqr.adulterado);
} finally {
  await navegador.close();
  servidor.close();
}
console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log("  FALHA:", f);
process.exit(falhas.length ? 1 : 0);
