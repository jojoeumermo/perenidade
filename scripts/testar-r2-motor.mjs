// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prova mínima das bibliotecas escolhidas para a onda R2 (chat no nível do Signal), rodando de verdade no Node:
// - o motor (@wireapp/core-crypto): MLS na suíte híbrida ML-KEM-768 + X25519 (entrar, mandar, repetir é recusado, tirar alguém e
//   ele não ler mais, troca de época) e o Proteus (Double Ratchet: fora de ordem, repetida e adulterada recusadas);
// - a libsodium: Argon2id (64 MiB, 3, 1) igual ao do @noble/hashes, que passa no vetor do RFC 9106; X-Wing (encapsular e abrir);
// - o Privacy Pass (RFC 9578, tipo VOPRF): lote, passe válido, adulterado e de outra chave recusados;
// - a divisão de segredo (Shamir) e as 24 palavras (BIP39, lista em português).
// Uso: npm run testar:r2-motor
import { argon2id } from "@noble/hashes/argon2.js";
import { privateVerif, genericBatched, Token } from "@cloudflare/privacypass-ts";
import { split, combine } from "shamir-secret-sharing";
import { generateMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist as portugues } from "@scure/bip39/wordlists/portuguese.js";
import { motorNoNode } from "./cifra-no-node.mjs";
import { SUITE_MLS } from "../lib/rede/cifra/motor.ts";
import { ARGON2ID, carregarSodio } from "../lib/rede/cifra/sodio.ts";

let certos = 0;
const falhas = [];
function confere(nome, ok, detalhe = "") {
  if (ok) certos++;
  else falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`);
}
async function recusa(nome, promessa) {
  try {
    await promessa();
    falhas.push(`${nome}: deveria recusar e passou`);
  } catch {
    certos++;
  }
}
const T = (s) => new TextEncoder().encode(s);
const D = (b) => new TextDecoder().decode(b);
const hex = (b) => Buffer.from(b).toString("hex");

// ── Motor: MLS ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const M = await motorNoNode();
const enviados = [];
const transporte = {
  async sendCommitBundle(pacote) {
    enviados.push(pacote);
  },
  async prepareForTransport() {
    throw new Error("historico_desligado");
  },
};
async function membro() {
  const cc = M.CoreCrypto.new(M.Database.inMemory());
  const id = new M.ClientId(new M.Uuid(crypto.randomUUID()), new M.DeviceId(1n), "alumia.invalid");
  const ref = await cc.transaction(async (c) => {
    await c.mlsInit(id, transporte);
    return c.addCredential(M.Credential.basic(M.cipherSuiteFromU16(SUITE_MLS), id));
  });
  return { cc, id, ref };
}
const [ana, bia, caio] = [await membro(), await membro(), await membro()];
const grupo = new M.ConversationId(crypto.getRandomValues(new Uint8Array(32)));
const pacotes = [await bia.cc.transaction((c) => c.generateKeyPackage(bia.ref)), await caio.cc.transaction((c) => c.generateKeyPackage(caio.ref))];
await ana.cc.transaction(async (c) => {
  await c.createConversation(grupo, ana.ref);
  await c.addClientsToConversation(grupo, pacotes);
});
const entrada = enviados.at(-1);
for (const m of [bia, caio]) await m.cc.transaction((c) => c.processWelcomeMessage(entrada.welcome));
confere("MLS: a suíte do grupo é a híbrida", (await bia.cc.transaction((c) => c.conversationCipherSuite(grupo))) === SUITE_MLS);
const primeira = await ana.cc.transaction((c) => c.encryptMessage(grupo, T("bom dia")));
const lida = await caio.cc.transaction((c) => c.decryptMessage(grupo, primeira));
confere("MLS: o membro lê", D(lida.inner?.plaintext ?? new Uint8Array()) === "bom dia");
await recusa("MLS: a mesma mensagem de novo é recusada", () => caio.cc.transaction((c) => c.decryptMessage(grupo, primeira)));
// Os dois primeiros bytes são a versão (mls10); os dois seguintes, o formato: 1 = mensagem pública (quem manda e o que muda às claras).
confere("MLS: o commit sai como mensagem pública (a Alumia embrulha antes de depositar)", entrada.commit[3] === 1);
await ana.cc.transaction((c) => c.removeClientsFromConversation(grupo, [caio.id]));
await bia.cc.transaction((c) => c.decryptMessage(grupo, enviados.at(-1).commit));
const depois = await ana.cc.transaction((c) => c.encryptMessage(grupo, T("sem o caio")));
await recusa("MLS: quem saiu não lê a época seguinte", () => caio.cc.transaction((c) => c.decryptMessage(grupo, depois)));
confere("MLS: quem ficou lê", D((await bia.cc.transaction((c) => c.decryptMessage(grupo, depois))).inner.plaintext) === "sem o caio");
await bia.cc.transaction((c) => c.updateKeyingMaterial(grupo));
await ana.cc.transaction((c) => c.decryptMessage(grupo, enviados.at(-1).commit));
const [ea, eb] = [await ana.cc.transaction((c) => c.conversationEpoch(grupo)), await bia.cc.transaction((c) => c.conversationEpoch(grupo))];
confere("MLS: a troca de chave leva as duas à mesma época", ea === eb && ea === 3n, `${ea}/${eb}`);

// ── Motor: Proteus ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const [A, B] = [M.CoreCrypto.new(M.Database.inMemory()), M.CoreCrypto.new(M.Database.inMemory())];
await A.transaction((c) => c.proteusInit());
await B.transaction((c) => c.proteusInit());
const preB = await B.transaction((c) => c.proteusNewPrekeyAuto());
await A.transaction((c) => c.proteusSessionFromPrekey("ab", preB.pkb));
const p1 = await A.transaction((c) => c.proteusEncrypt("ab", T("oi")));
confere("Proteus: a primeira abre", D(await B.transaction((c) => c.proteusDecryptSafe("ba", p1))) === "oi");
await recusa("Proteus: repetida é recusada", () => B.transaction((c) => c.proteusDecryptSafe("ba", p1)));
const x1 = await B.transaction((c) => c.proteusEncrypt("ba", T("1")));
const x2 = await B.transaction((c) => c.proteusEncrypt("ba", T("2")));
const x3 = await B.transaction((c) => c.proteusEncrypt("ba", T("3")));
confere("Proteus: fora de ordem abre", D(await A.transaction((c) => c.proteusDecryptSafe("ab", x3))) === "3" && D(await A.transaction((c) => c.proteusDecryptSafe("ab", x1))) === "1");
const mexida = new Uint8Array(x2);
mexida[mexida.length - 3] ^= 1;
await recusa("Proteus: adulterada é recusada", () => A.transaction((c) => c.proteusDecryptSafe("ab", mexida)));
confere("Proteus: a íntegra abre depois da adulterada", D(await A.transaction((c) => c.proteusDecryptSafe("ab", x2))) === "2");
confere("Proteus: as impressões batem", (await B.transaction((c) => c.proteusFingerprintRemote("ba"))) === (await A.transaction((c) => c.proteusFingerprint())));

// ── libsodium: Argon2id e X-Wing ───────────────────────────────────────────────────────────────────────────────────────────
const S = await carregarSodio();
const sal = S.randombytes_buf(ARGON2ID.sal);
const a = S.crypto_pwhash(ARGON2ID.saida, T("uma senha"), sal, ARGON2ID.passadas, ARGON2ID.memoria, S.crypto_pwhash_ALG_ARGON2ID13);
const b = argon2id(T("uma senha"), sal, { t: ARGON2ID.passadas, m: ARGON2ID.memoria / 1024, p: ARGON2ID.linhas, dkLen: ARGON2ID.saida });
confere("Argon2id: libsodium = @noble/hashes", hex(a) === hex(b));
// RFC 9106, seção 5.3 (Argon2id com segredo e dados associados), na implementação usada para a conferência cruzada.
const rfc = argon2id(new Uint8Array(32).fill(1), new Uint8Array(16).fill(2), { t: 3, m: 32, p: 4, dkLen: 32, key: new Uint8Array(8).fill(3), personalization: new Uint8Array(12).fill(4) });
confere("Argon2id: vetor do RFC 9106", hex(rfc) === "0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659"); // gitleaks:allow (valor de teste)
const par = S.crypto_kem_xwing_keypair();
const enc = S.crypto_kem_xwing_enc(par.publicKey);
confere("X-Wing: encapsula e abre", hex(S.crypto_kem_xwing_dec(enc.ciphertext, par.privateKey)) === hex(enc.sharedSecret));
const ctMexido = new Uint8Array(enc.ciphertext);
ctMexido[0] ^= 1;
confere("X-Wing: cifrado mexido dá outro segredo", hex(S.crypto_kem_xwing_dec(ctMexido, par.privateKey)) !== hex(enc.sharedSecret));

// ── Privacy Pass (RFC 9578, VOPRF P-384) ───────────────────────────────────────────────────────────────────────────────────
const { privateKey, publicKey } = await privateVerif.keyGen();
const emissor = new privateVerif.Issuer("alumia.invalid", privateKey, publicKey);
const origem = new privateVerif.Origin(["alumia.invalid"]);
const desafio = origem.createTokenChallenge("alumia.invalid", new Uint8Array(0));
const clientes = [new privateVerif.Client(), new privateVerif.Client(), new privateVerif.Client()];
const pedidos = [];
for (const c of clientes) pedidos.push(new genericBatched.TokenRequest(await c.createTokenRequest(desafio, publicKey)));
const lote = new genericBatched.Client().createTokenRequest(pedidos);
const respostas = await new genericBatched.Issuer(emissor).issue(genericBatched.BatchedTokenRequest.deserialize(lote.serialize()));
const passes = [];
let i = 0;
for (const r of respostas) passes.push(await clientes[i++].finalize(r.tokenResponse));
confere("Privacy Pass: o lote inteiro vale", (await Promise.all(passes.map((p) => origem.verify(p, privateKey)))).every(Boolean));
const mexido = new Uint8Array(passes[0].serialize());
mexido[mexido.length - 1] ^= 1;
confere("Privacy Pass: adulterado não vale", !(await origem.verify(Token.deserialize(privateVerif.VOPRF, mexido), privateKey)));
confere("Privacy Pass: de outra chave não vale", !(await origem.verify(passes[0], (await privateVerif.keyGen()).privateKey)));

// ── Shamir e as 24 palavras ────────────────────────────────────────────────────────────────────────────────────────────────
const semente = crypto.getRandomValues(new Uint8Array(32));
const partes = await split(semente, 5, 3);
confere("Shamir: 3 de 5 refazem", hex(await combine([partes[4], partes[0], partes[2]])) === hex(semente));
confere("Shamir: 2 de 5 não refazem", hex(await combine([partes[1], partes[3]])) !== hex(semente));
const frase = generateMnemonic(portugues, 256);
confere("BIP39: 24 palavras em português", frase.split(" ").length === 24 && validateMnemonic(frase, portugues));
confere("BIP39: volta aos 32 bytes", mnemonicToEntropy(frase, portugues).length === 32);

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
