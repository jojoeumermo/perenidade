// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o manifesto dos arquivos do chat (scripts/manifesto-do-chat.mjs): o mesmo commit dá o mesmo manifesto, os arquivos da
// cifra saem marcados, e a conferência ACUSA o site que entrega um arquivo trocado (um byte que seja), que some com um arquivo,
// ou um manifesto com caminho estranho. Confere também que as marcas do chat existem de verdade no código da cifra.
// Uso: npm run testar:manifesto-do-chat
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { conferir, ehDoChat, gerar, MARCAS_DO_CHAT, validar } from "./manifesto-do-chat.mjs";

let certos = 0;
const falhas = [];
async function espera(nome, promessa, conferirValor = () => true) {
  try {
    const valor = await promessa();
    if (conferirValor(valor)) certos++;
    else falhas.push(`${nome}: veio ${JSON.stringify(valor)?.slice(0, 300)}`);
  } catch (erro) {
    falhas.push(`${nome}: ${erro.message}`);
  }
}

const COMMIT = "0123456789abcdef0123456789abcdef01234567";
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), "manifesto-"));
fs.mkdirSync(path.join(pasta, "chunks"), { recursive: true });
fs.mkdirSync(path.join(pasta, "media"), { recursive: true });
fs.writeFileSync(path.join(pasta, "chunks", "comum.js"), "console.log('pagina comum')");
fs.writeFileSync(path.join(pasta, "chunks", "chat.js"), 'const i=new TextEncoder().encode("alumia/r2/envelope/v1");');
fs.writeFileSync(path.join(pasta, "media", "core-crypto-11.0.1.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]));
fs.writeFileSync(path.join(pasta, "media", "pglite.9xyz.wasm"), Buffer.from([0, 97, 115, 109, 1, 0, 0, 1]));
fs.writeFileSync(path.join(pasta, "media", "foto.png"), "não entra");

const manifesto = gerar(pasta, COMMIT);
const servidor = new Map(Object.keys(manifesto.arquivos).map((nome) => [nome, fs.readFileSync(path.join(pasta, nome.replace("/_next/static/", "")))]));
const baixar = async (nome) => servidor.get(nome) ?? null;

await espera("o manifesto lista script, estilo e WebAssembly, com o caminho do site", async () => Object.keys(manifesto.arquivos).sort(),
  (l) => JSON.stringify(l) === JSON.stringify(["/_next/static/chunks/chat.js", "/_next/static/chunks/comum.js", "/_next/static/media/core-crypto-11.0.1.wasm", "/_next/static/media/pglite.9xyz.wasm"]));
await espera("os arquivos da cifra saem marcados; o comum e o WebAssembly de outra coisa, não", async () => Object.fromEntries(Object.entries(manifesto.arquivos).map(([n, a]) => [n, !!a.chat])),
  (m) => m["/_next/static/chunks/chat.js"] && m["/_next/static/media/core-crypto-11.0.1.wasm"] && !m["/_next/static/chunks/comum.js"] && !m["/_next/static/media/pglite.9xyz.wasm"]);
await espera("o mesmo commit dá o mesmo manifesto (sem hora dentro)", async () => JSON.stringify(gerar(pasta, COMMIT)) === JSON.stringify(manifesto), (v) => v === true);
await espera("cada arquivo leva o SHA-256 e o valor de integrity (SHA-384)", async () => manifesto.arquivos["/_next/static/chunks/chat.js"],
  (a) => /^[0-9a-f]{64}$/.test(a.sha256) && /^sha384-[A-Za-z0-9+/]{64}$/.test(a.sri));

await espera("o site entrega os mesmos arquivos: confere", () => conferir(manifesto, baixar), (r) => r.diferencas.length === 0 && r.conferidos === 2 && r.total === 2);
await espera("com --todos, confere também o código comum", () => conferir(manifesto, baixar, { todos: true }), (r) => r.diferencas.length === 0 && r.conferidos === 4);

const trocado = Buffer.from(servidor.get("/_next/static/chunks/chat.js"));
trocado[trocado.length - 2] ^= 1;
await espera("um byte trocado no arquivo do chat: acusa", () => conferir(manifesto, async (n) => (n.endsWith("chat.js") ? trocado : servidor.get(n))),
  (r) => r.diferencas.length === 1 && r.diferencas[0].includes("DIFERENTE"));
await espera("o site some com o WebAssembly da cifra: acusa", () => conferir(manifesto, async (n) => (n.endsWith(".wasm") ? null : servidor.get(n))),
  (r) => r.diferencas.some((d) => d.includes("não entregou")));
await espera("manifesto com caminho que sai da pasta: recusado", async () => {
  try {
    validar({ ...manifesto, arquivos: { "/_next/static/../../etc/senha": { sha256: "0".repeat(64) } } });
    return "aceitou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("estranha"));
await espera("o que não é manifesto: recusado", async () => {
  try {
    validar({ formato: "outro", commit: COMMIT, arquivos: {} });
    return "aceitou";
  } catch (e) {
    return e.message;
  }
}, (m) => m.includes("não é um manifesto"));

// As marcas precisam existir no código da cifra: se alguém trocar um rótulo, o manifesto deixaria de achar o chat.
const codigo = ["lib/rede/chat/r2/rotulos.ts", "lib/rede/chat/transparencia.ts", "lib/rede/grupos/rotulos-do-motor.ts", "lib/rede/chat/r3/camada-pq.ts"]
  .map((f) => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
await espera("cada marca do chat está no código da cifra", async () => MARCAS_DO_CHAT.filter((m) => !codigo.includes(m)), (faltam) => faltam.length === 0);

// Onda R3: o WebAssembly do SPQR e um pedaço que só tem a camada pós-quântica também são do chat.
await espera("o WebAssembly do SPQR e o código da camada pós-quântica saem marcados; outro WebAssembly, não",
  async () => [ehDoChat("media/spqr-1.7.0.wasm", Buffer.alloc(8)), ehDoChat("chunks/pq.js", Buffer.from('h("alumia/r3/pq/camada/v1")')), ehDoChat("media/outra-1.0.wasm", Buffer.alloc(8))],
  (v) => v[0] === true && v[1] === true && v[2] === false);

fs.rmSync(pasta, { recursive: true, force: true });
console.log(`${certos} conferências certas${falhas.length ? `, ${falhas.length} com problema.` : "."}`);
for (const falha of falhas) console.log(`  ✗ ${falha}`);
process.exit(falhas.length ? 1 : 0);
