// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prova a cifra do voto em limiar (onda R2, item 1.7; lib/rede/voto/limiar.ts), no Node, com ataques escritos como teste:
//   - ida e volta: criar a chave (3 de 5), votar, cada guardiã abre e repassa a parte, a abridora refaz e abre as cédulas;
//   - K−1 partes não abrem; parte de outra votação, de outro tipo ou de outra guardiã não abre; parte torta não impede abrir com
//     as outras e não entra na conta;
//   - o servidor que troca a chave pública da votação ou a chave de voto de uma guardiã é pego pela assinatura;
//   - cédula mexida, de outra votação ou de outro tipo não abre; formato fora do tamanho é recusado;
//   - o servidor com tudo o que guarda (registro, partes cifradas, cédulas e o segredo dele) não abre nada: nem pela derivação de
//     antes (ALUMIA_VOTO_SEGREDO), nem procurando a privada da votação nos bytes guardados;
//   - X-Wing da libsodium = X-Wing do @noble/post-quantum (conferência cruzada, chave e encapsulamento determinísticos);
//   - o embaralhamento sem viés e o sorteio forte.
// Uso: npm run testar:r2-voto-cifra
import { createHmac } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { XWing } from "@noble/post-quantum/hybrid.js";
import * as L from "../lib/rede/voto/limiar.ts";
import { carregarSodio } from "../lib/rede/cifra/sodio.ts";

let certos = 0;
const falhas = [];
const ok = (nome, cond) => (cond ? certos++ : falhas.push(nome));
const hex = (b) => Buffer.from(b).toString("hex");
const S = await carregarSodio();
const uuid = () => crypto.randomUUID();

// ── As pessoas: cada uma com a identidade da conta (Ed25519) e, as guardiãs, com a chave de voto assinada ──
function pessoa() {
  const privada = ed25519.utils.randomSecretKey();
  return { usuario: uuid(), privada, identidade: ed25519.getPublicKey(privada) };
}
async function guardia() {
  const p = pessoa();
  const par = await L.novaChaveDeGuardia();
  const assinatura = ed25519.sign(L.textoDaGuardia(p.usuario, par.publica), p.privada);
  return { ...p, voto: par.publica, votoPrivada: par.privada, assinatura };
}
const guardias = [];
for (let i = 0; i < 5; i++) guardias.push(await guardia());
const criadora = pessoa();
const alvo = uuid();

// ═══════════ 1. A chave de cada guardiã ═══════════
ok("chave de guardiã: 1216 bytes de pública, 32 de privada", guardias[0].voto.length === 1216 && guardias[0].votoPrivada.length === 32);
ok("a assinatura da chave de guardiã confere com a identidade dela", L.conferirGuardia(guardias[0].identidade, guardias[0].usuario, guardias[0].voto, guardias[0].assinatura));
ok("…e não confere com a identidade de outra pessoa", !L.conferirGuardia(guardias[1].identidade, guardias[0].usuario, guardias[0].voto, guardias[0].assinatura));
ok("…nem para outra conta (a conta entra no texto assinado)", !L.conferirGuardia(guardias[0].identidade, guardias[1].usuario, guardias[0].voto, guardias[0].assinatura));
ok("…nem com a chave de voto trocada", !L.conferirGuardia(guardias[0].identidade, guardias[0].usuario, guardias[1].voto, guardias[0].assinatura));

// ═══════════ 2. Criar a chave da votação ═══════════
const candidatas = guardias.map((g) => ({ usuario: g.usuario, voto: g.voto, identidade: g.identidade, assinatura: g.assinatura }));
const { chave, partes } = await L.criarChaveDaVotacao({
  tipo: "consulta", alvo, k: 3, guardias: candidatas, criador: criadora.usuario, criadorIdentidade: criadora.identidade,
  assinar: (t) => ed25519.sign(t, criadora.privada),
});
ok("a chave tem 5 guardiãs, K = 3, e uma parte cifrada por guardiã (1193 bytes cada)", chave.n === 5 && chave.k === 3 && partes.length === 5 && partes.every((p) => p.cifrada.length === L.TAMANHOS.parteCifrada));
ok("o registro da chave confere (formato, guardiãs e assinatura de quem criou)", L.conferirChave(chave) === "ok");
const impressao = L.impressaoDaChave(chave);
ok("a impressão da chave tem 12 algarismos em 3 grupos e é a mesma para o mesmo registro", /^\d{4} \d{4} \d{4}$/.test(impressao) && L.impressaoDaChave({ ...chave }) === impressao);

let recusou = "";
try {
  await L.criarChaveDaVotacao({ tipo: "consulta", alvo, k: 3, guardias: [...candidatas.slice(0, 4), { ...candidatas[4], voto: guardias[0].voto }], criador: criadora.usuario, criadorIdentidade: criadora.identidade, assinar: (t) => ed25519.sign(t, criadora.privada) });
} catch (e) {
  recusou = e.message;
}
ok("criar recusa guardiã cuja chave de voto não confere com a identidade (o servidor trocou a chave dela)", recusou === "guardia_sem_assinatura");
for (const [nome, k, n] of [["K = 1", 1, 5], ["K maior que N", 6, 5], ["N = 2", 2, 2], ["N = 8", 3, 8]]) {
  let r = "";
  try {
    const lista = n <= 5 ? candidatas.slice(0, n) : [...candidatas, ...(await Promise.all([guardia(), guardia(), guardia()])).map((g) => ({ usuario: g.usuario, voto: g.voto, identidade: g.identidade, assinatura: g.assinatura }))].slice(0, n);
    await L.criarChaveDaVotacao({ tipo: "consulta", alvo, k, guardias: lista, criador: criadora.usuario, criadorIdentidade: criadora.identidade, assinar: (t) => ed25519.sign(t, criadora.privada) });
  } catch (e) {
    r = e.message;
  }
  ok(`criar recusa ${nome}`, r === "invalido:guardias");
}

// O servidor mexe no registro antes de entregar a quem vota: a assinatura de quem criou acusa.
const outroPar = S.crypto_kem_xwing_keypair();
ok("registro com a chave pública trocada pelo servidor: a assinatura não confere", L.conferirChave({ ...chave, publica: outroPar.publicKey }) === "assinatura");
ok("registro com K trocado (3 → 2): a assinatura não confere", L.conferirChave({ ...chave, k: 2 }) === "assinatura");
const servidorComoGuardia = { ...chave.guardias[0], voto: outroPar.publicKey };
ok("registro com a chave de voto de uma guardiã trocada: a assinatura da guardiã não confere", L.conferirChave({ ...chave, guardias: [servidorComoGuardia, ...chave.guardias.slice(1)] }) === "guardia");
const forjador = pessoa();
const forjado = { ...chave, publica: outroPar.publicKey, criadorIdentidade: forjador.identidade };
forjado.assinatura = ed25519.sign(L.textoDaChave(forjado), forjador.privada);
ok("registro refeito e assinado pelo servidor com outra identidade: confere por dentro (por isso a identidade de quem criou é conferida no registro de transparência) e a impressão muda", L.conferirChave(forjado) === "ok" && L.impressaoDaChave(forjado) !== impressao && L.identidadesDaChave(forjado)[0].identidade === forjador.identidade);
ok("registro com uma guardiã repetida é recusado", L.conferirChave({ ...chave, guardias: [chave.guardias[0], chave.guardias[0], ...chave.guardias.slice(2)] }) === "formato");

// ═══════════ 3. Votar ═══════════
const opcoes = [uuid(), uuid(), uuid()];
const rankings = [[opcoes[0], opcoes[1]], [opcoes[2]], [opcoes[1], opcoes[2], opcoes[0]], [opcoes[0]]];
const cedulas = [];
for (const r of rankings) cedulas.push(await L.cifrarCedula(chave, r));
ok("a cédula tem o tamanho fixo (\"v2.\" + 2230 letras), seja qual for a escolha", cedulas.every((c) => c.length === L.LETRAS_DA_CEDULA && L.LETRAS_DA_CEDULA === 2233));
ok("duas cédulas com a mesma escolha são diferentes (KEM e nonce novos)", (await L.cifrarCedula(chave, rankings[1])) !== (await L.cifrarCedula(chave, rankings[1])));
let grande = "";
try {
  await L.cifrarCedula(chave, "x".repeat(600));
} catch (e) {
  grande = e.message;
}
ok("escolha que não cabe em 512 bytes é recusada (não muda o tamanho da cédula)", grande === "invalido:escolha");

// ═══════════ 4. Abrir a urna ═══════════
// Cada guardiã abre a parte dela; a abridora é a guardiã 2.
const abertas = [];
for (const g of chave.guardias) {
  const dona = guardias.find((x) => x.usuario === g.usuario);
  abertas.push({ indice: g.indice, parte: await L.abrirParte(dona.votoPrivada, chave, g.indice, partes[g.indice - 1].cifrada) });
}
ok("cada guardiã abre a sua parte (33 bytes)", abertas.every((a) => a.parte?.length === 33));
ok("a guardiã não abre a parte de outra", (await L.abrirParte(guardias[0].votoPrivada, chave, 2, partes[1].cifrada)) === null);
ok("a parte não abre com o número de outra guardiã (o número entra no dado autenticado)", (await L.abrirParte(guardias[0].votoPrivada, chave, 2, partes[0].cifrada)) === null);
ok("a parte não abre noutra votação", (await L.abrirParte(guardias[0].votoPrivada, { tipo: "consulta", alvo: uuid() }, 1, partes[0].cifrada)) === null);
ok("a parte não abre noutro tipo de votação", (await L.abrirParte(guardias[0].votoPrivada, { tipo: "equipe", alvo }, 1, partes[0].cifrada)) === null);
const mexida = partes[0].cifrada.slice();
mexida[1150] ^= 1;
ok("parte mexida não abre", (await L.abrirParte(guardias[0].votoPrivada, chave, 1, mexida)) === null);

const abridora = guardias.find((x) => x.usuario === chave.guardias[1].usuario);
const repassadas = [];
for (const a of abertas) repassadas.push({ indice: a.indice, cifrada: await L.repassarParte(abridora.voto, chave, a.indice, a.parte) });
ok("a parte repassada não abre como parte original (outro rótulo)", (await L.abrirParte(abridora.votoPrivada, chave, 1, repassadas[0].cifrada)) === null);
ok("a parte repassada não abre com a chave de outra guardiã", (await L.abrirRepasse(guardias[0].votoPrivada, chave, 1, repassadas[0].cifrada)) === null);
const naAbridora = [];
for (const r of repassadas) naAbridora.push({ indice: r.indice, parte: await L.abrirRepasse(abridora.votoPrivada, chave, r.indice, r.cifrada) });
ok("a abridora abre as partes repassadas", naAbridora.every((a) => a.parte?.length === 33));

const doisDeCinco = await L.refazerChave(chave, naAbridora.slice(0, 2));
ok("com K−1 partes (2 de 5) não refaz", doisDeCinco === null);
const tres = await L.refazerChave(chave, [naAbridora[4], naAbridora[0], naAbridora[2]]);
ok("com K partes (3 de 5, em qualquer ordem) refaz e confere com a chave publicada", tres !== null && tres.usadas.join(",") === "1,3,5");
const torta = { indice: 2, parte: S.randombytes_buf(33) };
const comTorta = await L.refazerChave(chave, [naAbridora[0], torta, naAbridora[2], naAbridora[3]]);
ok("uma parte torta não impede abrir com as outras, e fica de fora", comTorta !== null && !comTorta.usadas.includes(2));
ok("com só K partes e uma torta, não refaz (e nada abre: alarme na tela)", (await L.refazerChave(chave, [naAbridora[0], torta, naAbridora[2]])) === null);
ok("partes certas não refazem uma chave publicada diferente", (await L.refazerChave({ ...chave, publica: outroPar.publicKey }, naAbridora)) === null);

const abertasAsCedulas = [];
for (const c of cedulas) abertasAsCedulas.push(await L.abrirCedula(tres.privada, chave, c));
ok("a abridora abre todas as cédulas, com a escolha certa", JSON.stringify(abertasAsCedulas) === JSON.stringify(rankings));
const cedMexida = L.paraBase64url(L.bytesDaCedula(cedulas[0]).map((b, i) => (i === 1300 ? b ^ 1 : b)));
ok("cédula mexida não abre (conta como nula)", (await L.abrirCedula(tres.privada, chave, `v2.${cedMexida}`)) === null);
ok("cédula não abre noutra votação", (await L.abrirCedula(tres.privada, { tipo: "consulta", alvo: uuid() }, cedulas[0])) === null);
ok("cédula não abre noutro tipo", (await L.abrirCedula(tres.privada, { tipo: "decisao", alvo }, cedulas[0])) === null);
ok("cédula fora do formato é recusada antes de tudo", L.bytesDaCedula("c1.abc") === null && L.bytesDaCedula(cedulas[0].slice(0, -1)) === null && L.bytesDaCedula(`${cedulas[0]}A`) === null);

// ═══════════ 5. O servidor com tudo o que guarda ═══════════
// O servidor tem: o registro da chave, as partes cifradas, as cédulas e o segredo dele (ALUMIA_VOTO_SEGREDO). Não tem a privada de
// nenhuma guardiã (fica no aparelho dela) nem a semente (apagada no aparelho de quem criou).
const segredo = "segredo-de-teste-do-servidor-com-32-letras-ou-mais"; // gitleaks:allow (valor de teste)
const guardado = [L.textoDaChave(chave), chave.assinatura, ...partes.map((p) => p.cifrada), ...repassadas.map((r) => r.cifrada), ...cedulas.map((c) => L.bytesDaCedula(c))];
const tudo = Buffer.concat(guardado.map((b) => Buffer.from(b)));
ok("a privada da votação não aparece em nenhum byte que o servidor guarda", !tudo.includes(Buffer.from(tres.privada)));
ok("nenhuma parte aberta aparece nos bytes guardados", naAbridora.every((a) => !tudo.includes(Buffer.from(a.parte))));
// A derivação de antes (o servidor tirava a chave da consulta do segredo dele): agora não dá a chave da votação.
const antes = createHmac("sha256", createHmac("sha256", segredo).update("alumia:voto:consulta").digest()).update(`consulta:${alvo}:0`).digest();
ok("a chave que o servidor derivava do segredo dele não é a da votação", hex(S.crypto_kem_xwing_seed_keypair(antes).publicKey) !== hex(chave.publica));
ok("e não abre nenhuma cédula", (await Promise.all(cedulas.map((c) => L.abrirCedula(S.crypto_kem_xwing_seed_keypair(antes).privateKey, chave, c)))).every((x) => x === null));
// O servidor tenta abrir as partes com chaves que ele mesmo tem (uma chave dele, ou derivada do segredo): nada.
const doServidor = S.crypto_kem_xwing_seed_keypair(createHmac("sha256", segredo).update("guardia").digest());
ok("o servidor não abre parte nenhuma com chave dele", (await Promise.all(partes.map((p, i) => L.abrirParte(doServidor.privateKey, chave, i + 1, p.cifrada)))).every((x) => x === null));
ok("nem parte repassada", (await Promise.all(repassadas.map((r) => L.abrirRepasse(doServidor.privateKey, chave, r.indice, r.cifrada)))).every((x) => x === null));
ok("a cédula leva só bytes sorteados e cifrados (nenhum id de opção às claras)", cedulas.every((c) => opcoes.every((o) => !c.includes(o) && !Buffer.from(L.bytesDaCedula(c)).includes(Buffer.from(o)))));

// ═══════════ 6. X-Wing: libsodium = @noble/post-quantum ═══════════
// As duas implementam o draft-connolly-cfrg-xwing-kem; com a mesma semente, a mesma chave; com o mesmo sorteio, o mesmo encapsulamento.
let cruzadas = 0;
for (let i = 0; i < 5; i++) {
  const semente = S.randombytes_buf(32);
  // Cada biblioteca recebe a sua cópia: uma delas pode zerar o que recebeu.
  const sodio = S.crypto_kem_xwing_seed_keypair(semente.slice());
  const noble = XWing.keygen(semente.slice());
  const sorteio = S.randombytes_buf(64);
  const ePelaSodio = S.crypto_kem_xwing_enc_deterministic(sodio.publicKey, sorteio.slice());
  const ssNoble = XWing.decapsulate(ePelaSodio.ciphertext, noble.secretKey);
  const pkNoble = noble.publicKey.slice();
  const eNoble = XWing.encapsulate(pkNoble, sorteio.slice());
  if (hex(sodio.publicKey) === hex(noble.publicKey) && hex(ssNoble) === hex(ePelaSodio.sharedSecret) && hex(eNoble.cipherText) === hex(ePelaSodio.ciphertext)) cruzadas++;
}
ok("X-Wing: a libsodium e o @noble/post-quantum dão a mesma chave, o mesmo encapsulamento e o mesmo segredo (5 de 5)", cruzadas === 5);
// Achado desta revisão: o XWing.encapsulate do @noble/post-quantum 0.5.2 ZERA a chave pública que recebe (1210 dos 1216 bytes).
// Quem usar essa função passa uma cópia. Este arquivo (lib/rede/voto/limiar.ts) usa só a libsodium, que não mexe no que recebe.
const pkTeste = XWing.keygen(new Uint8Array(32).fill(5)).publicKey;
const pkGuardada = pkTeste.slice();
XWing.encapsulate(pkTeste);
ok("(registro) o XWing.encapsulate do @noble/post-quantum muda a chave recebida; a libsodium não", hex(pkTeste) !== hex(pkGuardada) && (() => {
  const p = S.crypto_kem_xwing_keypair().publicKey;
  const g = p.slice();
  S.crypto_kem_xwing_enc(p);
  return hex(p) === hex(g);
})());

// ═══════════ 7. Embaralhar e sortear ═══════════
const contagem = [0, 0, 0];
for (let i = 0; i < 30_000; i++) contagem[L.sortear(3)]++;
ok("o sorteio em [0, 3) é uniforme (cada valor entre 9.400 e 10.600 em 30 mil)", contagem.every((c) => c > 9_400 && c < 10_600));
const posicoes = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
for (let i = 0; i < 20_000; i++) L.embaralhar([0, 1, 2, 3]).forEach((v, p) => posicoes[v][p]++);
ok("o embaralhamento põe cada item em cada posição por igual (4.600 a 5.400 em 20 mil)", posicoes.every((l) => l.every((c) => c > 4_600 && c < 5_400)));
let semMath = true;
const original = Math.random;
Math.random = () => {
  semMath = false;
  return 0;
};
L.embaralhar([1, 2, 3, 4, 5]);
Math.random = original;
ok("embaralhar não usa Math.random", semMath);
ok("os rótulos do voto são todos diferentes e do formato da casa", new Set(Object.values(L.ROTULOS)).size === Object.values(L.ROTULOS).length && Object.values(L.ROTULOS).every((r) => /^alumia\/r2\/voto\/[a-z]+\/v1$/.test(r)));

console.log(`r2-voto-cifra: ${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  FALHOU: ${f}`);
process.exit(falhas.length ? 1 : 0);
