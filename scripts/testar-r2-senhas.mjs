// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova o item 1.6 da onda R2 (PBKDF2 → Argon2id em todo lugar que deriva chave de senha no aparelho), no Node:
//   - lib/rede/cofre/argon.ts: os valores (64 MiB, 3 passadas, 1 linha), o cabeçalho que não aceita valor menor, a mesma chave
//     com o mesmo cabeçalho, a conferência cruzada com o Argon2id da @noble/hashes, e o selar/abrir (XChaCha20-Poly1305) com
//     nonce que não se repete em 100 mil gravações;
//   - o cofre da senha de pânico: Argon2id, o cofre de antes (PBKDF2) regravado sem mudar os bytes, aberto e refeito com o
//     Argon2id, e o tempo igual com e sem cofre real;
//   - o cofre da Escola: o de antes abre com a frase e é refeito com o Argon2id, sem perder nada; cabeçalho mexido não abre nem
//     grava em claro;
//   - a trava do histórico do chat: Argon2id, e a trava de antes abre e é refeita;
//   - os selos por código de lib/sigilo.ts: Argon2id, e o selo de antes ainda abre.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r2-senhas.mjs
import "fake-indexeddb/auto";
import { argon2id } from "@noble/hashes/argon2.js";
import { webcrypto } from "node:crypto";

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
async function recusa(nome, promessa, codigo) {
  try {
    const valor = await promessa();
    falhas.push(`${nome}: deveria recusar com "${codigo}", mas passou (${JSON.stringify(valor)?.slice(0, 160)})`);
  } catch (erro) {
    if (String(erro?.code ?? erro?.message).includes(codigo)) certos++;
    else falhas.push(`${nome}: esperava "${codigo}", veio "${erro?.message}"`);
  }
}
const s = webcrypto.subtle;
const T = new TextEncoder();
const hex = (b) => Buffer.from(b).toString("hex");
const b64 = (b) => Buffer.from(b).toString("base64");
const deB64 = (t) => new Uint8Array(Buffer.from(t, "base64"));
const mediana = (l) => [...l].sort((a, b) => a - b)[Math.floor(l.length / 2)];
async function tempo(f) {
  const t0 = performance.now();
  await f();
  return performance.now() - t0;
}

class Armazem {
  m = new Map();
  get length() {
    return this.m.size;
  }
  key(i) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k) {
    return this.m.has(k) ? this.m.get(k) : null;
  }
  setItem(k, v) {
    this.m.set(k, String(v));
  }
  removeItem(k) {
    this.m.delete(k);
  }
}
globalThis.localStorage = new Armazem();

const { ARGON2ID } = await import("../lib/rede/cifra/sodio.ts");
const argon = await import("../lib/rede/cofre/argon.ts");

// ═══════════════════ 1. O Argon2id ═══════════════════
ok("os valores: 64 MiB, 3 passadas, 1 linha, sal de 16 e saída de 32", ARGON2ID.memoria === 64 * 1024 * 1024 && ARGON2ID.passadas === 3 && ARGON2ID.linhas === 1 && ARGON2ID.sal === 16 && ARGON2ID.saida === 32);
const t0 = performance.now();
const d1 = await argon.derivar("uma senha");
const custo = performance.now() - t0;
console.log(`  (Argon2id 64 MiB, 3 passadas, nesta máquina: ${custo.toFixed(0)} ms)`);
ok("o cabeçalho novo leva os valores e um sal de 16 bytes", d1.cabecalho.v === 1 && d1.cabecalho.alg === "argon2id13" && d1.cabecalho.m === 65536 && d1.cabecalho.t === 3 && d1.cabecalho.p === 1 && deB64(d1.cabecalho.sal).length === 16);
ok("a chave tem 32 bytes", d1.chave.length === 32);
const d2 = await argon.derivar("uma senha", d1.cabecalho);
ok("o mesmo cabeçalho e a mesma senha dão a mesma chave", hex(d1.chave) === hex(d2.chave));
ok("outra senha dá outra chave", hex((await argon.derivar("uma senhA", d1.cabecalho)).chave) !== hex(d1.chave));
ok("outro sal dá outra chave", hex((await argon.derivar("uma senha")).chave) !== hex(d1.chave));
ok("a senha com acento vale escrita de qualquer jeito (NFC)",
  hex((await argon.derivar("Paçoca", d1.cabecalho)).chave) === hex((await argon.derivar("Paçoca", d1.cabecalho)).chave));
const noble = argon2id(T.encode("uma senha"), deB64(d1.cabecalho.sal), { t: 3, m: 65536, p: 1, dkLen: 32 });
ok("conferência cruzada: a libsodium e a @noble/hashes dão o mesmo Argon2id", hex(noble) === hex(d1.chave));
await recusa("cabeçalho com menos memória (32 MiB) é recusado", () => argon.derivar("x", { ...d1.cabecalho, m: 32768 }), "cabecalho_invalido");
await recusa("cabeçalho com menos passadas (2) é recusado", () => argon.derivar("x", { ...d1.cabecalho, t: 2 }), "cabecalho_invalido");
await recusa("cabeçalho com outra linha (p = 2) é recusado", () => argon.derivar("x", { ...d1.cabecalho, p: 2 }), "cabecalho_invalido");
await recusa("cabeçalho de outro algoritmo é recusado", () => argon.derivar("x", { ...d1.cabecalho, alg: "argon2i13" }), "cabecalho_invalido");
await recusa("cabeçalho que pede memória absurda (2 GiB) é recusado", () => argon.derivar("x", { ...d1.cabecalho, m: 2 * 1024 * 1024 }), "cabecalho_invalido");
await recusa("cabeçalho com sal curto é recusado", () => argon.derivar("x", { ...d1.cabecalho, sal: b64(new Uint8Array(8)) }), "cabecalho_invalido");
ok("o código não usa Math.random", !/Math\.random/.test((await import("node:fs")).readFileSync(new URL("../lib/rede/cofre/argon.ts", import.meta.url), "utf8")));

// selar/abrir
const chave = d1.chave;
const selado = await argon.selar(chave, "escola", T.encode("um segredo"));
ok("selar e abrir", new TextDecoder().decode(await argon.abrir(chave, "escola", selado)) === "um segredo");
ok("outra finalidade não abre (rótulo como dado autenticado)", (await argon.abrir(chave, "panico", selado)) === null);
ok("outra chave não abre", (await argon.abrir(d2.chave.map((x, i) => (i === 0 ? x ^ 1 : x)), "escola", selado)) === null);
const mexido = selado.slice();
mexido[30] ^= 1;
ok("um bit mexido não abre", (await argon.abrir(chave, "escola", mexido)) === null);
ok("curto demais não abre (nem lança)", (await argon.abrir(chave, "escola", new Uint8Array(10))) === null);
const nonces = new Set();
for (let i = 0; i < 100_000; i++) nonces.add(hex((await argon.selar(chave, "escola", new Uint8Array(1))).subarray(0, 24)));
ok("o nonce não se repete em 100 mil gravações com a mesma chave", nonces.size === 100_000);

// ═══════════════════ 2. O cofre da senha de pânico ═══════════════════
const panico = await import("../lib/rede/seguranca/cofre-de-panico.ts");
const conteudo = { email: "isca@exemplo.test", senha: panico.gerarSenhaDaIsca(), codinome: "Isca", criada: new Date().toISOString() };
{
  const a = new Armazem();
  const cofre = await panico.fecharCofre("Corre pro mato 22", conteudo);
  ok("o cofre novo é v2, com os valores do Argon2id", cofre.v === 2 && cofre.m === 65536 && cofre.t === 3 && cofre.p === 1 && !("voltas" in cofre));
  ok("abre com a senha de pânico", (await panico.abrirCofre("Corre pro mato 22", cofre, a))?.email === conteudo.email);
  ok("senha errada não abre", (await panico.abrirCofre("Corre pro mato 23", cofre, a)) === null);
  ok("abrir um cofre novo não grava nada", a.getItem(panico.CHAVE_DO_COFRE) === null);
  ok("cofre com valores mexidos (menos memória) não é cofre", !panico.cofreValido({ ...cofre, m: 4096 }) && (await panico.abrirCofre("Corre pro mato 22", { ...cofre, m: 4096 }, a)) === null);
  const fachada = panico.cofreDeFachada();
  ok("o de fachada tem os mesmos campos e valores do de verdade", JSON.stringify(Object.keys(fachada)) === JSON.stringify(Object.keys(cofre)) && fachada.m === cofre.m && fachada.t === cofre.t);

  // O cofre de antes, montado como o código de antes montava (PBKDF2 600 mil + HKDF + AES-GCM).
  async function cofreDeAntes(senha, c) {
    const sal = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const base = await s.importKey("raw", T.encode(senha.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
    const seg = await s.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 600_000 }, base, 256);
    const mestre = await s.importKey("raw", seg, "HKDF", false, ["deriveBits", "deriveKey"]);
    const k = await s.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: T.encode("alumia-cofre/v1/chave") }, mestre, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
    const ver = new Uint8Array(await s.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: T.encode("alumia-cofre/v1/verificador") }, mestre, 256));
    const cifra = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv, additionalData: T.encode("alumia-cofre/v1") }, k, T.encode(JSON.stringify(c))));
    return { v: 1, voltas: 600_000, sal: b64(sal), iv: b64(iv), verificador: b64(ver), cifra: b64(cifra) };
  }
  const antigo = await cofreDeAntes("Senha de antes 7", conteudo);
  const b = new Armazem();
  b.setItem(panico.CHAVE_DO_COFRE, JSON.stringify(antigo));
  const lido = panico.lerCofre(b);
  ok("o cofre de antes é lido como v2, com os mesmos bytes", lido?.v === 2 && lido.sal === antigo.sal && lido.iv === antigo.iv && lido.verificador === antigo.verificador && lido.cifra === antigo.cifra);
  panico.garantirCofre(b);
  const regravado = JSON.parse(b.getItem(panico.CHAVE_DO_COFRE));
  ok("e é regravado como v2 na entrada (por fora, igual a qualquer outro: não diz que é de verdade)",
    regravado.v === 2 && JSON.stringify(Object.keys(regravado)) === JSON.stringify(Object.keys(fachada)) && regravado.cifra === antigo.cifra);
  ok("a senha errada não abre o cofre de antes", (await panico.abrirCofre("Senha de antes 8", lido, b)) === null);
  ok("e o cofre fica como estava", b.getItem(panico.CHAVE_DO_COFRE) === JSON.stringify(regravado));
  const aberto = await panico.abrirCofre("Senha de antes 7", lido, b);
  ok("a senha de pânico abre o cofre de antes, sem perder nada", JSON.stringify(aberto) === JSON.stringify(conteudo));
  const refeito = panico.lerCofre(b);
  ok("e o cofre é refeito na hora com o Argon2id (sal, vetor e cifra novos)", refeito?.v === 2 && refeito.sal !== antigo.sal && refeito.cifra !== antigo.cifra);
  ok("o refeito abre com a mesma senha", JSON.stringify(await panico.abrirCofre("Senha de antes 7", refeito, b)) === JSON.stringify(conteudo));
  ok("o refeito NÃO abre mais pelo PBKDF2 de antes (o verificador é o do Argon2id)", await (async () => {
    const base = await s.importKey("raw", T.encode("Senha de antes 7"), "PBKDF2", false, ["deriveBits"]);
    const seg = await s.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: deB64(refeito.sal), iterations: 600_000 }, base, 256);
    const mestre = await s.importKey("raw", seg, "HKDF", false, ["deriveBits"]);
    const ver = new Uint8Array(await s.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: T.encode("alumia-cofre/v1/verificador") }, mestre, 256));
    return b64(ver) !== refeito.verificador;
  })());

  // O tempo: com cofre de fachada, com cofre de verdade e senha errada, e com a senha de pânico, gastam o mesmo (as duas derivações
  // rodam sempre). Medianas de 5 vezes; a diferença tem de ficar abaixo de 20%.
  const vezes = 5;
  const tFachada = [], tErrada = [], tCerta = [];
  for (let i = 0; i < vezes; i++) {
    tFachada.push(await tempo(() => panico.abrirCofre("Corre pro mato 22", fachada, null)));
    tErrada.push(await tempo(() => panico.abrirCofre("Corre pro mato 23", cofre, null)));
    tCerta.push(await tempo(() => panico.abrirCofre("Corre pro mato 22", cofre, null)));
  }
  const [mf, me, mc] = [mediana(tFachada), mediana(tErrada), mediana(tCerta)];
  console.log(`  (pânico, medianas: fachada ${mf.toFixed(0)} ms, real com senha errada ${me.toFixed(0)} ms, real com a senha ${mc.toFixed(0)} ms)`);
  const maior = Math.max(mf, me, mc), menor = Math.min(mf, me, mc);
  ok(`a senha de pânico gasta o mesmo tempo com e sem cofre real (diferença ${(((maior - menor) / menor) * 100).toFixed(0)}% < 20%)`, (maior - menor) / menor < 0.2);
  ok("e o tempo inclui o Argon2id e o PBKDF2 de antes (nunca menos que o Argon2id sozinho)", menor >= custo * 0.8);
}

// ═══════════════════ 3. O cofre da Escola ═══════════════════
{
  globalThis.localStorage = new Armazem();
  const escola = await import("../lib/escola/cofre.ts");
  localStorage.setItem("lucia:escola-privado:conversas", '[{"texto":"onde eu trabalho"}]');
  ok("cria o cofre com a frase", (await escola.criarCofre("uma frase longa")) === true);
  const meta = JSON.parse(localStorage.getItem("lucia:escola-cofre:meta"));
  ok("o cabeçalho é v2, com o Argon2id", meta.v === 2 && meta.a2id?.alg === "argon2id13" && meta.a2id.m === 65536 && meta.a2id.t === 3 && !("voltas" in meta));
  ok("o bloco guardado não mostra o texto", !localStorage.getItem("lucia:escola-cofre:dados").includes("trabalho"));
  escola.fecharCofre();
  ok("frase errada não abre", (await escola.abrirCofre("outra frase")) === false && escola.estadoDoCofre() === "fechado");
  ok("frase certa abre e lê o que estava", (await escola.abrirCofre("uma frase longa")) === true && escola.armazemPrivado()?.getItem("lucia:escola-privado:conversas")?.includes("onde eu trabalho"));
  escola.fecharCofre();

  // Cabeçalho mexido para uma derivação fraca: o cofre não abre e não vira "sem cofre" (nada é gravado em claro por cima).
  const bom = localStorage.getItem("lucia:escola-cofre:meta");
  localStorage.setItem("lucia:escola-cofre:meta", JSON.stringify({ v: 2, a2id: { ...meta.a2id, m: 1024 } }));
  ok("cabeçalho fraco: o cofre fica fechado (não volta a gravar em claro)", escola.estadoDoCofre() === "fechado" && escola.armazemPrivado() === null);
  ok("e a frase certa não abre com ele", (await escola.abrirCofre("uma frase longa")) === false);
  localStorage.setItem("lucia:escola-cofre:meta", bom);

  // O cofre de antes (PBKDF2 600 mil + AES-GCM, "iv.corpo"), montado como o código de antes montava.
  escola.apagarCofre();
  const sal = webcrypto.getRandomValues(new Uint8Array(16));
  const base = await s.importKey("raw", T.encode("frase de antes 123".normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  const k = await s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 600_000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const corpo = await s.encrypt({ name: "AES-GCM", iv }, k, T.encode(JSON.stringify({ "lucia:escola-privado:diario": '{"dia":"guardado antes"}' })));
  localStorage.setItem("lucia:escola-cofre:dados", `${b64(iv)}.${b64(new Uint8Array(corpo))}`);
  localStorage.setItem("lucia:escola-cofre:meta", JSON.stringify({ v: 1, sal: b64(sal), voltas: 600_000 }));
  ok("o cofre de antes conta como fechado", escola.estadoDoCofre() === "fechado");
  ok("a frase errada não abre o de antes (e não mexe nele)", (await escola.abrirCofre("frase de antes 124")) === false && JSON.parse(localStorage.getItem("lucia:escola-cofre:meta")).v === 1);
  ok("a frase certa abre o de antes", (await escola.abrirCofre("frase de antes 123")) === true);
  ok("sem perder nada", escola.armazemPrivado()?.getItem("lucia:escola-privado:diario") === '{"dia":"guardado antes"}');
  const novaMeta = JSON.parse(localStorage.getItem("lucia:escola-cofre:meta"));
  ok("e o cofre é refeito na hora com o Argon2id", novaMeta.v === 2 && novaMeta.a2id?.alg === "argon2id13");
  escola.fecharCofre();
  ok("depois de refeito, abre com a mesma frase", (await escola.abrirCofre("frase de antes 123")) === true && escola.armazemPrivado()?.getItem("lucia:escola-privado:diario") === '{"dia":"guardado antes"}');
  escola.fecharCofre();
}

// ═══════════════════ 4. A trava do histórico do chat ═══════════════════
{
  const h = await import("../lib/rede/chat/historico.ts");
  const CONTA = "11111111-1111-4111-8111-111111111111";
  const OUTRA = "22222222-2222-4222-8222-222222222222";
  const CONVERSA = "33333333-3333-4333-8333-333333333333";
  const agora = Date.now();
  const msg = (conta, id, texto) => ({
    id, conta, conversa: CONVERSA, autor: OUTRA, quando: new Date(agora).toISOString(), expira: new Date(agora + 86_400_000).toISOString(), texto,
    idInterno: `id-${id}`, contador: 1, visto: { versao: 0, contador: 0 }, versao: 1, umaVez: false,
  });
  await h.guardarNoHistorico(msg(CONTA, "a", "primeira"));
  await h.travarHistorico(CONTA, "uma senha boa");
  const abrirBanco = () => new Promise((r) => { const p = indexedDB.open("lucia-alumia-historico"); p.onsuccess = () => r(p.result); });
  const lerChave = async (conta) => {
    const banco = await abrirBanco();
    const g = await new Promise((r) => { const p = banco.transaction("chaves").objectStore("chaves").get(conta); p.onsuccess = () => r(p.result); });
    banco.close();
    return g;
  };
  const g = await lerChave(CONTA);
  ok("a trava guarda o cabeçalho do Argon2id (e não o sal do PBKDF2)", g.a2id?.alg === "argon2id13" && g.a2id.m === 65536 && !g.sal);
  h.esquecerChavesDoHistorico();
  await recusa("senha errada não abre", () => h.destravarHistorico(CONTA, "outra senha"), "senha_errada");
  await h.destravarHistorico(CONTA, "uma senha boa");
  ok("a senha certa abre", (await h.mensagensDoHistorico(CONTA, CONVERSA)).map((m) => m.texto).join() === "primeira");

  // A trava de antes: a chave do histórico embrulhada por PBKDF2 (600 mil), e uma mensagem cifrada com ela.
  const LEGADO = "44444444-4444-4444-8444-444444444444";
  const interna = await s.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const salAntigo = webcrypto.getRandomValues(new Uint8Array(16));
  const baseAntiga = await s.importKey("raw", T.encode("trava de antes"), "PBKDF2", false, ["deriveKey"]);
  const kekAntiga = await s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: salAntigo, iterations: 600_000 }, baseAntiga, { name: "AES-KW", length: 256 }, false, ["wrapKey"]);
  const embrulhada = await s.wrapKey("raw", interna, kekAntiga, "AES-KW");
  const ivm = webcrypto.getRandomValues(new Uint8Array(12));
  const dentro = { texto: "guardada antes", idInterno: "id-l", contador: 1, visto: { versao: 0, contador: 0 }, versao: 1, umaVez: false };
  const cifrado = await s.encrypt({ name: "AES-GCM", iv: ivm, additionalData: T.encode(`alumia-historico:${LEGADO}:l1`) }, interna, T.encode(JSON.stringify(dentro)));
  {
    const banco = await abrirBanco();
    await new Promise((r) => {
      const tx = banco.transaction(["chaves", "mensagens"], "readwrite");
      tx.objectStore("chaves").put({ conta: LEGADO, embrulhada, sal: salAntigo });
      const m = msg(LEGADO, "l1", "");
      tx.objectStore("mensagens").put({ id: "l1", conta: LEGADO, conversa: CONVERSA, autor: OUTRA, quando: m.quando, expira: m.expira, iv: ivm, cifrado });
      tx.oncomplete = r;
    });
    banco.close();
  }
  await recusa("a trava de antes não abre com a senha errada", () => h.destravarHistorico(LEGADO, "trava de antez"), "senha_errada");
  ok("e continua a de antes", !!(await lerChave(LEGADO)).sal);
  await h.destravarHistorico(LEGADO, "trava de antes");
  ok("a trava de antes abre com a senha, sem perder nada", (await h.mensagensDoHistorico(LEGADO, CONVERSA)).map((m) => m.texto).join() === "guardada antes");
  const refeita = await lerChave(LEGADO);
  ok("e é refeita com o Argon2id (sai o sal do PBKDF2)", refeita.a2id?.alg === "argon2id13" && !refeita.sal);
  h.esquecerChavesDoHistorico();
  await h.destravarHistorico(LEGADO, "trava de antes");
  ok("depois de refeita, abre com a mesma senha e lê a mensagem de antes", (await h.mensagensDoHistorico(LEGADO, CONVERSA)).map((m) => m.texto).join() === "guardada antes");
  h.esquecerChavesDoHistorico();
}

// ═══════════════════ 5. Os selos por código (lib/sigilo.ts) ═══════════════════
{
  const sig = await import("../lib/sigilo.ts");
  const USUARIO = "55555555-5555-4555-8555-555555555555";
  const publica = "B" + "A".repeat(86);
  const codigo = sig.novoCodigo();
  const pedido = await sig.selarPedido(codigo, USUARIO, publica);
  ok("o pedido selado com o Argon2id abre com o código", (await sig.abrirPedido(codigo, USUARIO, pedido)) === publica);
  ok("código errado não abre", (await sig.abrirPedido(codigo === "00000000" ? "11111111" : "00000000", USUARIO, pedido)) === null);
  ok("o formato que o banco confere não mudou (sal 22, vetor 16, cifrado 100 a 160)", /^[A-Za-z0-9_-]{22}$/.test(pedido.sal) && /^[A-Za-z0-9_-]{16}$/.test(pedido.iv) && /^[A-Za-z0-9_-]{100,160}$/.test(pedido.cifrado));
  // Um pedido de antes (PBKDF2 300 mil), montado como o código de antes montava.
  const sal = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const base = await s.importKey("raw", T.encode(`pedido:${codigo}`), "PBKDF2", false, ["deriveKey"]);
  const k = await s.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: 300_000 }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  // Na junção da R2, o pedido ganhou a hora (C3: vale 10 minutos, contados no próprio pedido) e o código de 12 números (frente dos
  // grupos): o selo de antes (PBKDF2) ainda abre, mas só o pedido com a hora dentro vale; o do formato de antes (sem a hora) é recusado,
  // porque a idade dele não se confere.
  const selarAntigo = async (texto) => {
    const c = new Uint8Array(await s.encrypt({ name: "AES-GCM", iv, additionalData: T.encode(`pedido:${USUARIO}`) }, k, T.encode(texto)));
    return { sal: sig.paraBase64(sal), iv: sig.paraBase64(iv), cifrado: sig.paraBase64(c) };
  };
  ok("o selo de antes (PBKDF2) ainda abre, com a hora dentro", (await sig.abrirPedido(codigo, USUARIO, await selarAntigo(`${publica}|${Date.now()}`))) === publica);
  ok("o pedido do formato de antes (sem a hora) é recusado", (await sig.abrirPedido(codigo, USUARIO, await selarAntigo(publica))) === null);
  // A cópia de recuperação.
  const rec = sig.novaChaveDeRecuperacao();
  const copia = { identidade: { secreta: "x", publica }, chaves: [], quando: new Date().toISOString() };
  const selada = await sig.selarCopia(rec, USUARIO, copia);
  ok("a cópia de recuperação sela com o Argon2id e abre", (await sig.abrirCopia(rec, USUARIO, selada))?.identidade.publica === publica);
  ok("com outra chave de recuperação, não abre", (await sig.abrirCopia(sig.novaChaveDeRecuperacao(), USUARIO, selada)) === null);
}

console.log(`r2-senhas: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
