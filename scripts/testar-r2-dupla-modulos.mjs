// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os módulos do chat que ficaram depois da troca da conversa a dois para a R2 e que o teste do chat do beta (testar-rede-chat.mjs,
// que saiu junto com o banco do beta) provava: o preenchimento em blocos (lib/rede/chat/padding.ts, ainda usado pelos grupos até a
// frente deles), o código de segurança e o comparar de novo (lib/rede/chat/verificacao.ts, sobre o código da identidade da conta da
// R2) e o endereço do chat (lib/rede/chat/origem.ts): a política inteira e o que passa lá, agora com as rotas anônimas das caixas.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-dupla-modulos.mjs
import fs from "node:fs";
import { createHash } from "node:crypto";
import { preencher, tamanhoDoBloco, tirarPreenchimento } from "../lib/rede/chat/padding.ts";
import { codigoComMetadeEscondida, conferirMetade, conferirMetadeDe, conferirQr, metadeDaOutraPessoa } from "../lib/rede/chat/verificacao.ts";
import { arquivoNoChat, hashesDosScripts, politicaDoChat, SERVICOS_DO_CHAT } from "../lib/rede/chat/origem.ts";
import { codigoDeSeguranca, identidadeNaTela, metadeDoCodigo } from "../lib/rede/chat-privado.ts";
import { lerQrDaSeguranca, qrDaSeguranca } from "../lib/sigilo.ts";
import { prefsScript } from "../lib/prefs-script.ts";
import { scriptDaAparencia } from "../lib/rede/aparencia-da-rede.ts";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferir = () => true) {
  try {
    const valor = await promessa();
    if (!conferir(valor)) throw new Error(`resultado inesperado: ${JSON.stringify(valor)?.slice(0, 300)}`);
    certos++;
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}
const ler = (caminho) => fs.readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8");
const tentar = (fazer) => {
  try {
    fazer();
    return "passou";
  } catch (erro) {
    return erro.message;
  }
};
const bytes = (n) => new Uint8Array(n).fill(7);

// ── Preenchimento em blocos ──
await espera("o preenchimento vai e volta, sempre no menor bloco em que o conteúdo cabe", async () => [0, 1, 252, 253, 508, 509, 1020, 1021, 2044, 2045, 4092, 4093, 6140, 6141, 8188].map((n) => {
  const bloco = preencher(bytes(n));
  const volta = tirarPreenchimento(bloco);
  return [bloco.length, tamanhoDoBloco(n) === bloco.length && volta.length === n && volta.every((x) => x === 7)];
}), (l) => l.map((x) => x[0]).join(",") === "256,256,256,512,512,1024,1024,2048,2048,4096,4096,6144,6144,8192,8192" && l.every((x) => x[1]));
await espera("conteúdo maior que o maior bloco é recusado", async () => tentar(() => preencher(bytes(8189))), (m) => m === "conteudo_grande");
const adulterado = (mexer) => {
  const bloco = preencher(bytes(100));
  mexer(bloco);
  return tentar(() => tirarPreenchimento(bloco));
};
await espera("preenchimento adulterado é erro: sobra que não é zero, comprimento que não bate, bloco maior que o preciso, tamanho fora da lista", async () => [
  adulterado((b) => { b[255] = 1; }),
  adulterado((b) => { b[104] = 1; }),
  adulterado((b) => { new DataView(b.buffer).setUint32(0, 300); }),
  adulterado((b) => { new DataView(b.buffer).setUint32(0, 99); }),
  tentar(() => {
    const grande = new Uint8Array(512);
    new DataView(grande.buffer).setUint32(0, 100);
    tirarPreenchimento(grande);
  }),
  tentar(() => tirarPreenchimento(new Uint8Array(300))),
], (l) => l.length === 6 && l.every((m) => m === "preenchimento_invalido"));

// ── Código de segurança da identidade da conta (R2) e o comparar de novo ──
const b64url = (u) => Buffer.from(u).toString("base64url");
const identidade = (conta) => identidadeNaTela(conta, b64url(crypto.getRandomValues(new Uint8Array(32))));
const ana = identidade("11111111-1111-4111-8111-111111111111");
const bia = identidade("22222222-2222-4222-8222-222222222222");
const intrusa = identidade("33333333-3333-4333-8333-333333333333");
const codigoAB = await codigoDeSeguranca(ana, bia);
const codigoAI = await codigoDeSeguranca(ana, intrusa);
await espera("o código tem 60 algarismos e é o mesmo nos dois lados", async () => [codigoAB, await codigoDeSeguranca(bia, ana)], ([a, b]) => /^\d{60}$/.test(a) && a === b);
await espera("o código muda se a conta for outra com a mesma chave (a conta entra no código)", async () => {
  const chave = ana.slice(ana.indexOf(":") + 1);
  return [codigoAB, await codigoDeSeguranca(identidadeNaTela("44444444-4444-4444-8444-444444444444", chave), bia)];
}, ([a, b]) => a !== b);
await espera("QR do código de segurança: ida e volta, e confere", async () => [lerQrDaSeguranca(qrDaSeguranca(codigoAB)) === codigoAB, conferirQr(qrDaSeguranca(codigoAB), codigoAB)], (r) => r[0] === true && r[1] === "confere");
await espera("QR errado: código de outra pessoa não confere; QR de outra coisa não é código", async () => [
  conferirQr(qrDaSeguranca(codigoAI), codigoAB),
  conferirQr("lucia:aparelho:12345678:abc", codigoAB),
  conferirQr("qualquer coisa", codigoAB),
  conferirQr(qrDaSeguranca(codigoAB).slice(0, -1), codigoAB),
], (r) => r.join(",") === "nao_confere,outro,outro,outro");
await espera("comparar de novo: pede os seis grupos da metade da OUTRA pessoa, escondidos na tela; a minha metade não passa", async () => {
  const minha = await metadeDoCodigo(ana);
  const daBia = await metadeDoCodigo(bia);
  const daIntrusa = await metadeDoCodigo(intrusa);
  const outra = metadeDaOutraPessoa(codigoAB, minha);
  const naTela = outra ? codigoComMetadeEscondida(codigoAB, outra.inicio) : [];
  const visiveis = naTela.filter((g) => g !== "•••••").join("");
  const errada = daBia.slice(0, 29) + (daBia[29] === "0" ? "1" : "0");
  return [
    outra?.numeros === daBia && naTela.length === 12 && naTela.filter((g) => g === "•••••").length === 6 && visiveis === minha,
    conferirMetade(codigoAB, minha, daBia),
    conferirMetade(codigoAB, minha, daBia.replace(/(.{5})/g, "$1 ")),
    conferirMetade(codigoAB, minha, minha),
    conferirMetade(codigoAB, minha, daIntrusa),
    conferirMetade(codigoAB, minha, errada),
    conferirMetade(codigoAB, minha, daBia.slice(0, 25)),
    conferirMetade(codigoAB, minha, ""),
    conferirMetade(codigoAB, daIntrusa, daBia),
    metadeDaOutraPessoa(codigoAB, daIntrusa) === null && metadeDaOutraPessoa(minha + minha, minha) === null,
  ];
}, (r) => r.join(",") === "true,true,true,false,false,false,false,false,false,true");
await espera("ataque simétrico: a mesma identidade falsa no lugar das duas pessoas; ditar os próprios grupos não confere com ela", async () => {
  const mA = await metadeDoCodigo(ana);
  const mB = await metadeDoCodigo(bia);
  const mF = await metadeDoCodigo(intrusa);
  const telaDaBia = await codigoDeSeguranca(bia, intrusa);
  return [telaDaBia.includes(mF), conferirMetadeDe(mF, mF), conferirMetadeDe(mF, mB), conferirMetadeDe(mB, mB.replace(/(.{5})/g, "$1 ")), conferirMetadeDe(mB, mA), conferirMetadeDe(mB, mB.slice(0, 25)), conferirMetadeDe("123", mB)];
}, (r) => r.join(",") === "true,true,false,true,false,false,false");
await espera("identidade fora do formato (conta:32 bytes) é recusada", async () => [await codigoDeSeguranca("sem-dois-pontos", bia).then(() => "passou", (e) => e.message), await codigoDeSeguranca(`${"x"}:${b64url(new Uint8Array(31))}`, bia).then(() => "passou", (e) => e.message)], (r) => r.every((m) => m === "identidade_invalida"));

// ── O endereço do chat (conversas.* e o .onion) ──
{
  const pol = politicaDoChat("abc", false);
  const diretivas = Object.fromEntries(pol.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  await espera("a política do chat tem default-src 'self'", async () => diretivas["default-src"], (v) => v?.join(" ") === "'self'");
  await espera("a política do chat fecha connect-src, img-src, font-src, media-src, frame-src e worker-src", async () => ["connect-src", "img-src", "font-src", "media-src", "frame-src", "worker-src"].filter((k) => !diretivas[k]?.includes("'self'") || diretivas[k].some((o) => o === "*" || o === "https:" || o === "http:")), (f) => f.length === 0);
  await espera("a política do chat guarda o nonce, 'strict-dynamic', 'wasm-unsafe-eval' (o motor), frame-ancestors 'none' e object-src 'none', sem 'unsafe-eval'", async () => pol,
    (t) => t.includes("'nonce-abc'") && t.includes("'strict-dynamic'") && t.includes("'wasm-unsafe-eval'") && /frame-ancestors 'none'/.test(t) && /object-src 'none'/.test(t) && !/'unsafe-eval'/.test(t));
  const esperados = [prefsScript, scriptDaAparencia].map((t) => `'sha256-${createHash("sha256").update(t, "utf8").digest("base64")}'`);
  await espera("os hashes dos scripts da página são os do texto exato das preferências e da aparência", () => hashesDosScripts(), (h) => h.length === 2 && h.every((x, i) => x === esperados[i]));
  await espera("em desenvolvimento a política do chat aceita o ws: do recarregamento e o eval do webpack", async () => politicaDoChat("abc", true), (t) => /connect-src[^;]* ws:/.test(t) && t.includes("'unsafe-eval'"));
  const casos = {
    "/_next/static/chunks/a.js": "seguir", "/icone-192.png": "seguir", "/sw.js": "seguir", "/cifra/core-crypto-11.0.1.wasm": "seguir",
    "/pt/alumia/conversas": null, "/pt/entrar": null, "/": null,
    "/api/alumia/porta/entrar": null, "/api/alumia/conta": null, "/api/alumia/impressao": null,
    // As rotas anônimas das caixas (frente das caixas) e a denúncia com prova: o chat a dois da R2 só fala com o servidor por elas.
    "/api/alumia/caixa/lote": null, "/api/alumia/caixa/buscar": null, "/api/alumia/caixa/confirmar": null, "/api/alumia/caixa/trocar": null, "/api/alumia/caixa/apagar": null,
    "/api/alumia/pedido": null, "/api/alumia/pedido/desafio": null, "/api/alumia/diretorio/ler": null, "/api/alumia/diretorio/reivindicar": null,
    "/api/alumia/passes/chave": null, "/api/alumia/passes/emitir": null, "/api/alumia/franquia/denunciar": null,
    // Nem prefixo parecido passa.
    "/api/alumia/caixas": "barrar", "/api/alumia/pedidos": "barrar", "/api/alumia/diretorios/ler": "barrar",
    "/api/fediverso/buscar": "barrar", "/api/alumia/portaria": "barrar",
    "/pt/aulas.json": "barrar", "/podcast.xml": "barrar", "/sitemap.xml": "barrar", "/.well-known/webfinger": "barrar", "/robots.txt": "barrar",
  };
  await espera("no endereço do chat só passam as páginas, os arquivos delas, a entrada e as rotas das caixas; o resto é 404", async () => Object.entries(casos).filter(([c, v]) => arquivoNoChat(c) !== v), (f) => f.length === 0);
  await espera("a lista dos serviços do chat não tem a rota de voz (é da frente dos grupos) nem nada fora de /api/alumia", async () => SERVICOS_DO_CHAT, (l) => l.every((p) => p.startsWith("/api/alumia/")) && !l.some((p) => p.includes("voz")));
  await espera("o proxy decide o endereço do chat antes do retorno cedo de /api", async () => ler("proxy.ts"), (t) => t.indexOf("arquivoNoChat(pathname)") > 0 && t.indexOf("arquivoNoChat(pathname)") < t.indexOf('pathname.startsWith("/api/")'));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
