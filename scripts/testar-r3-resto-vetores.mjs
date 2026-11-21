// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (16): as bibliotecas de cifra que a Alumia usa, rodadas contra os vetores OFICIAIS (fonte oficial, commit
// fixo, sha256 conferido: scripts/vetores/fontes.json e scripts/vetores/baixar.mjs). Cada bloco usa a MESMA biblioteca e o MESMO jeito de
// chamar do código da Alumia:
//   - Wycheproof AES-GCM: WebCrypto (lib/anexos.ts; o AEAD do HPKE da @hpke/core também é o do WebCrypto);
//   - Wycheproof X25519: @noble/curves (o X25519 dentro do X-Wing da @noble/post-quantum) e a libsodium (crypto_scalarmult);
//   - Wycheproof Ed25519: @noble/curves, nos dois jeitos de chamar do código (estrito, zip215: false, e o padrão);
//   - Wycheproof HKDF-SHA256 e HMAC-SHA256: @noble/hashes;
//   - Wycheproof XChaCha20-Poly1305: libsodium (lib/rede/cofre/argon.ts, lib/rede/grupos/embrulho-da-epoca.ts);
//   - ML-KEM-768 (FIPS 203): ACVP do NIST (geração, encapsulamento, decapsulamento) e Wycheproof, na @noble/post-quantum;
//   - X-Wing: os vetores do rascunho, na @noble/post-quantum (lib/rede/aparelhos/identidade.ts) e na @hpke/hybridkem-x-wing (o envelope);
//   - RFC 9180 (HPKE): modo base, DHKEM(X25519, HKDF-SHA256), HKDF-SHA256, AES-128-GCM e AES-256-GCM, na @hpke/core;
//   - RFC 9497 (OPRF): VOPRF P384-SHA384 (a suíte dos passes), na @cloudflare/voprf-ts;
//   - RFC 9578 (Privacy Pass): tipo 1 (VOPRF, os passes de hoje) e tipo 2 (RSA cego, os passes da onda R3), na @cloudflare/privacypass-ts.
// Os casos "acceptable" do Wycheproof aceitam os dois resultados; "valid" tem de dar o esperado e "invalid" tem de ser recusado.
// Uso: node --import ./scripts/carregar-ts.mjs scripts/testar-r3-resto-vetores.mjs   (precisa de rede na primeira vez)
import { createPrivateKey } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex as hx, hexToBytes as h } from "@noble/hashes/utils.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { XWing } from "@noble/post-quantum/hybrid.js";
import { lerJson, lerTexto } from "./vetores/baixar.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let certos = 0;
const falhas = [];
const ok = (nome, cond, detalhe = "") => (cond ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));
const iguais = (a, b) => a != null && b != null && hx(a) === hx(b);
const sutil = globalThis.crypto.subtle;

/** Roda um arquivo do Wycheproof: `rodar(t, g)` devolve true (aceitou e deu o esperado) ou false (recusou ou deu outro). */
async function wycheproof(nome, arquivo, rodar) {
  const j = await lerJson(arquivo);
  let n = 0;
  const erros = [];
  for (const g of j.testGroups) {
    for (const t of g.tests) {
      let aceitou;
      try {
        aceitou = await rodar(t, g);
      } catch {
        aceitou = false;
      }
      if (aceitou === null) continue; // fora do que a Alumia usa (dito em cada bloco)
      n++;
      if (t.result === "valid" && !aceitou) erros.push(`${t.tcId} (válido recusado: ${t.comment ?? ""})`);
      if (t.result === "invalid" && aceitou) erros.push(`${t.tcId} (inválido aceito: ${t.comment ?? ""})`);
    }
  }
  ok(`${nome}: ${n} casos do Wycheproof`, n > 0 && erros.length === 0, erros.slice(0, 5).join("; "));
  return n;
}

// ═══════════════════ 1. Wycheproof ═══════════════════

// AES-GCM no WebCrypto, com o vetor de 96 bits e a etiqueta de 128 bits que a Alumia usa (lib/anexos.ts; a @hpke/core também). Os
// grupos de outro tamanho de vetor ficam de fora: o WebCrypto do Node recusa parte deles, e a Alumia nunca os usa.
await wycheproof("AES-GCM (WebCrypto)", "wycheproof/aes_gcm_test.json", async (t, g) => {
  if (g.tagSize !== 128 || g.ivSize !== 96) return null;
  const chave = await sutil.importKey("raw", h(t.key), "AES-GCM", false, ["encrypt", "decrypt"]);
  const alg = { name: "AES-GCM", iv: h(t.iv), additionalData: h(t.aad), tagLength: 128 };
  const aberto = new Uint8Array(await sutil.decrypt(alg, chave, new Uint8Array([...h(t.ct), ...h(t.tag)])));
  if (!iguais(aberto, h(t.msg))) return false;
  const cifrado = new Uint8Array(await sutil.encrypt(alg, chave, h(t.msg)));
  return iguais(cifrado, new Uint8Array([...h(t.ct), ...h(t.tag)]));
});

// X25519 na @noble/curves.
await wycheproof("X25519 (@noble/curves)", "wycheproof/x25519_test.json", (t) => {
  if (t.result === "acceptable") return null;
  return iguais(x25519.getSharedSecret(h(t.private), h(t.public)), h(t.shared));
});

// A libsodium (carregada como no site, pela lib/rede/cifra/sodio.ts).
const { carregarSodio } = await import("../lib/rede/cifra/sodio.ts");
const S = await carregarSodio();
await wycheproof("X25519 (libsodium)", "wycheproof/x25519_test.json", (t) => {
  if (t.result === "acceptable") return null;
  return iguais(S.crypto_scalarmult(h(t.private), h(t.public)), h(t.shared));
});

// Ed25519 na @noble/curves: o jeito estrito (lib/rede/chat/r2/certificados.ts) e o padrão da biblioteca.
for (const [modo, opcoes] of [["estrito (zip215: false)", { zip215: false }], ["padrão", undefined]]) {
  await wycheproof(`Ed25519 ${modo} (@noble/curves)`, "wycheproof/ed25519_test.json", (t, g) => {
    if (t.result === "acceptable") return null;
    return ed25519.verify(h(t.sig), h(t.msg), h(g.publicKey.pk), opcoes);
  });
}

await wycheproof("HKDF-SHA256 (@noble/hashes)", "wycheproof/hkdf_sha256_test.json", (t) =>
  iguais(hkdf(sha256, h(t.ikm), h(t.salt), h(t.info), t.size), h(t.okm)),
);

await wycheproof("HMAC-SHA256 (@noble/hashes)", "wycheproof/hmac_sha256_test.json", (t, g) =>
  iguais(hmac(sha256, h(t.key), h(t.msg)).subarray(0, g.tagSize / 8), h(t.tag)),
);

await wycheproof("XChaCha20-Poly1305 (libsodium)", "wycheproof/xchacha20_poly1305_test.json", (t) => {
  const aberto = S.crypto_aead_xchacha20poly1305_ietf_decrypt(null, new Uint8Array([...h(t.ct), ...h(t.tag)]), h(t.aad), h(t.iv), h(t.key));
  if (!iguais(aberto, h(t.msg))) return false;
  const cifrado = S.crypto_aead_xchacha20poly1305_ietf_encrypt(h(t.msg), h(t.aad), null, h(t.iv), h(t.key));
  return iguais(cifrado, new Uint8Array([...h(t.ct), ...h(t.tag)]));
});

// ═══════════════════ 2. ML-KEM-768 (FIPS 203): ACVP do NIST e Wycheproof ═══════════════════
//
// Duas bibliotecas: a libsodium (o ML-KEM dentro do X-Wing do voto, lib/rede/voto/limiar.ts) faz tudo: gerar, encapsular, decapsular e
// a conferência da chave pública (FIPS 203, 7.2); a @noble/post-quantum só GERA chaves na Alumia (a chave X-Wing do aparelho,
// lib/rede/aparelhos/identidade.ts). Achado desta onda: a @noble/post-quantum 0.5.2 NÃO recusa chave pública fora do módulo ao
// encapsular (o comentário dela diz que confere; os vetores mostram que não). A Alumia não encapsula com ela: o teste prende isso
// (nenhum arquivo do site chama o encapsulate da noble) e confere que o defeito continua sendo o que está escrito aqui.
{
  const [pg, eg, pe, ee] = await Promise.all(["fips203/keygen-prompt.json", "fips203/keygen-esperado.json", "fips203/encapdecap-prompt.json", "fips203/encapdecap-esperado.json"].map(lerJson));
  const esperado = (j, tg, tc) => j.testGroups.find((g) => g.tgId === tg)?.tests.find((t) => t.tcId === tc);
  const tenta = (f) => {
    try {
      f();
      return true;
    } catch {
      return false;
    }
  };
  const erros = [];
  let n = 0;
  for (const g of pg.testGroups.filter((x) => x.parameterSet === "ML-KEM-768")) {
    for (const t of g.tests) {
      const e = esperado(eg, g.tgId, t.tcId);
      const semente = new Uint8Array([...h(t.d), ...h(t.z)]);
      for (const [nome, gerar] of [["libsodium", (x) => { const p = S.crypto_kem_mlkem768_seed_keypair(x); return { publicKey: p.publicKey, secretKey: p.privateKey }; }], ["noble", (x) => ml_kem768.keygen(x)]]) {
        n++;
        const par = gerar(semente);
        if (!iguais(par.publicKey, h(e.ek)) || !iguais(par.secretKey, h(e.dk))) erros.push(`gerar ${nome} ${t.tcId}`);
      }
    }
  }
  let aceitasPelaNoble = 0;
  for (const g of pe.testGroups.filter((x) => x.parameterSet === "ML-KEM-768")) {
    for (const t of g.tests) {
      const e = esperado(ee, g.tgId, t.tcId);
      n++;
      try {
        if (g.function === "encapsulation") {
          const r = S.crypto_kem_mlkem768_enc_deterministic(h(t.ek), h(t.m));
          if (!iguais(r.ciphertext, h(e.c)) || !iguais(r.sharedSecret, h(e.k))) erros.push(`encapsular ${t.tcId}`);
        } else if (g.function === "decapsulation") {
          if (!iguais(S.crypto_kem_mlkem768_dec(h(t.c), h(t.dk)), h(e.k))) erros.push(`decapsular ${t.tcId}`);
        } else if (g.function === "encapsulationKeyCheck") {
          if (tenta(() => S.crypto_kem_mlkem768_enc_deterministic(h(t.ek), new Uint8Array(32))) !== e.testPassed) erros.push(`conferir chave pública (libsodium) ${t.tcId}`);
          if (!e.testPassed && tenta(() => ml_kem768.encapsulate(h(t.ek)))) aceitasPelaNoble++;
        } else if (g.function === "decapsulationKeyCheck") {
          // FIPS 203, 7.3: o resumo H(ek) guardado dentro de dk. A noble confere (decapsulate recusa); a libsodium NÃO confere, e não
          // precisa na Alumia: a chave privada X-Wing do voto é sempre a semente de 32 bytes (o dk é derivado dela no aparelho, nunca vem
          // de fora). O teste prende as duas coisas.
          if (tenta(() => ml_kem768.decapsulate(new Uint8Array(1088), h(t.dk))) !== e.testPassed) erros.push(`conferir chave privada (noble) ${t.tcId}`);
          if (S.crypto_kem_xwing_SECRETKEYBYTES !== 32) erros.push("a chave privada X-Wing da libsodium deixou de ser a semente");
        } else n--;
      } catch (erro) {
        erros.push(`${g.function} ${t.tcId}: ${erro.message}`);
      }
    }
  }
  ok(`FIPS 203 ML-KEM-768 (ACVP do NIST; libsodium inteira, noble só gerar): ${n} casos`, n >= 50 + 25 + 10 + 20 && erros.length === 0, erros.slice(0, 5).join("; "));
  ok("o defeito da noble continua o que está escrito (aceita chave pública fora do módulo ao encapsular)", aceitasPelaNoble > 0, String(aceitasPelaNoble));
}

await wycheproof("ML-KEM-768 encapsular (Wycheproof, libsodium)", "wycheproof/mlkem_768_encaps_test.json", (t) => {
  const r = S.crypto_kem_mlkem768_enc_deterministic(h(t.ek), h(t.m));
  return iguais(r.ciphertext, h(t.c)) && iguais(r.sharedSecret, h(t.K));
});
await wycheproof("ML-KEM-768 decapsular, rejeição implícita (Wycheproof, libsodium)", "wycheproof/mlkem_768_test.json", (t) => {
  const par = S.crypto_kem_mlkem768_seed_keypair(h(t.seed));
  if (t.ek && !iguais(par.publicKey, h(t.ek))) return false;
  return iguais(S.crypto_kem_mlkem768_dec(h(t.c), par.privateKey), h(t.K));
});
await wycheproof("ML-KEM-768 gerar e decapsular (Wycheproof, noble)", "wycheproof/mlkem_768_test.json", (t) => {
  const { publicKey, secretKey } = ml_kem768.keygen(h(t.seed));
  if (t.ek && !iguais(publicKey, h(t.ek))) return false;
  return iguais(ml_kem768.decapsulate(h(t.c), secretKey), h(t.K));
});
{
  // Nenhum arquivo do site encapsula com a noble (o defeito acima não chega ao que a Alumia faz).
  const achados = [];
  const varrer = (pasta) => {
    for (const e of fs.readdirSync(pasta, { withFileTypes: true })) {
      const c = path.join(pasta, e.name);
      if (e.isDirectory()) varrer(c);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const texto = fs.readFileSync(c, "utf8");
        if (/@noble\/post-quantum/.test(texto) && /\b(XWing|ml_kem\d+|MLKEM\w*)\.encapsulate\(/.test(texto)) achados.push(c);
      }
    }
  };
  for (const p of ["lib", "app", "components"]) varrer(path.join(raiz, p));
  ok("nenhum arquivo do site encapsula com a @noble/post-quantum", achados.length === 0, achados.join(", "));
}

// ═══════════════════ 3. X-Wing (os vetores do rascunho) ═══════════════════
{
  const v = await lerJson("xwing/test-vectors.json");
  const { XWing: XWingHpke } = await import("@hpke/hybridkem-x-wing");
  const kem = new XWingHpke();
  let n = 0;
  const erros = [];
  for (const [i, t] of v.entries()) {
    n++;
    // @noble/post-quantum: só gerar e abrir (a chave X-Wing do aparelho, lib/rede/aparelhos/identidade.ts).
    const par = XWing.keygen(h(t.seed));
    if (!iguais(par.publicKey, h(t.pk))) erros.push(`noble pública ${i}`);
    if (!iguais(XWing.decapsulate(h(t.ct), par.secretKey), h(t.ss))) erros.push(`noble decapsular ${i}`);
    // libsodium (o voto em limiar, lib/rede/voto/limiar.ts).
    const ps = S.crypto_kem_xwing_seed_keypair(h(t.seed));
    if (!iguais(ps.publicKey, h(t.pk))) erros.push(`libsodium pública ${i}`);
    const es = S.crypto_kem_xwing_enc_deterministic(h(t.pk), h(t.eseed));
    if (!iguais(es.ciphertext, h(t.ct)) || !iguais(es.sharedSecret, h(t.ss))) erros.push(`libsodium encapsular ${i}`);
    if (!iguais(S.crypto_kem_xwing_dec(h(t.ct), ps.privateKey), h(t.ss))) erros.push(`libsodium decapsular ${i}`);
    // @hpke/hybridkem-x-wing (o envelope X-Wing da conversa a dois, lib/rede/chat/r2/envelope.ts).
    const kp = await kem.generateKeyPairDerand(h(t.sk));
    if (!iguais(new Uint8Array(await kem.serializePublicKey(kp.publicKey)), h(t.pk))) erros.push(`hpke pública ${i}`);
    const enc = await kem.encap({ recipientPublicKey: kp.publicKey, ekm: h(t.eseed) });
    if (!iguais(new Uint8Array(enc.enc), h(t.ct)) || !iguais(new Uint8Array(enc.sharedSecret), h(t.ss))) erros.push(`hpke encapsular ${i}`);
    const dec = await kem.decap({ recipientKey: kp, enc: h(t.ct) });
    if (!iguais(new Uint8Array(dec), h(t.ss))) erros.push(`hpke decapsular ${i}`);
  }
  // Chave pública com um coeficiente do ML-KEM fora do módulo: as duas bibliotecas que encapsulam na Alumia recusam.
  const torta = h(v[0].pk);
  torta[0] = 0xff;
  torta[1] |= 0x0f;
  const recusou = async (f) => {
    try {
      await f();
      return false;
    } catch {
      return true;
    }
  };
  if (!(await recusou(async () => kem.encap({ recipientPublicKey: await kem.deserializePublicKey(torta) })))) erros.push("hpke aceitou chave fora do módulo");
  if (!(await recusou(() => S.crypto_kem_xwing_enc(torta)))) erros.push("libsodium aceitou chave fora do módulo");
  ok(`X-Wing (rascunho do CFRG): ${n} vetores nas três bibliotecas`, n >= 3 && erros.length === 0, erros.join("; "));
}

// ═══════════════════ 4. RFC 9180 (HPKE) ═══════════════════
{
  const todos = await lerJson("rfc9180/test-vectors.json");
  const { CipherSuite, DhkemX25519HkdfSha256, HkdfSha256, Aes128Gcm, Aes256Gcm } = await import("@hpke/core");
  const escolhidos = todos.filter((v) => v.mode === 0 && v.kem_id === 0x20 && v.kdf_id === 1 && (v.aead_id === 1 || v.aead_id === 2));
  let n = 0;
  const erros = [];
  for (const v of escolhidos) {
    const suite = new CipherSuite({ kem: new DhkemX25519HkdfSha256(), kdf: new HkdfSha256(), aead: v.aead_id === 1 ? new Aes128Gcm() : new Aes256Gcm() });
    const rec = await suite.kem.deriveKeyPair(h(v.ikmR));
    if (!iguais(new Uint8Array(await suite.kem.serializePrivateKey(rec.privateKey)), h(v.skRm))) erros.push(`skRm ${v.aead_id}`);
    if (!iguais(new Uint8Array(await suite.kem.serializePublicKey(rec.publicKey)), h(v.pkRm))) erros.push(`pkRm ${v.aead_id}`);
    const efemera = await suite.kem.deriveKeyPair(h(v.ikmE));
    const remetente = await suite.createSenderContext({ recipientPublicKey: rec.publicKey, info: h(v.info), ekm: efemera });
    if (!iguais(new Uint8Array(remetente.enc), h(v.enc))) erros.push(`enc ${v.aead_id}`);
    const destino = await suite.createRecipientContext({ recipientKey: rec, enc: h(v.enc), info: h(v.info) });
    // As cifragens do vetor são em sequência (o nonce avança): todas, na ordem.
    for (const [i, e] of v.encryptions.entries()) {
      n++;
      const ct = new Uint8Array(await remetente.seal(h(e.pt), h(e.aad)));
      if (!iguais(ct, h(e.ct))) erros.push(`selar ${v.aead_id}/${i}`);
      const pt = new Uint8Array(await destino.open(h(e.ct), h(e.aad)));
      if (!iguais(pt, h(e.pt))) erros.push(`abrir ${v.aead_id}/${i}`);
    }
    for (const [i, e] of v.exports.entries()) {
      n++;
      if (!iguais(new Uint8Array(await destino.export(h(e.exporter_context), e.L)), h(e.exported_value))) erros.push(`exportar ${v.aead_id}/${i}`);
    }
    // Adulterado: um bit trocado na primeira cifragem não abre.
    const dest2 = await suite.createRecipientContext({ recipientKey: rec, enc: h(v.enc), info: h(v.info) });
    const torto = h(v.encryptions[0].ct);
    torto[0] ^= 1;
    const abriu = await dest2.open(torto, h(v.encryptions[0].aad)).then(() => true, () => false);
    if (abriu) erros.push(`adulterado abriu ${v.aead_id}`);
  }
  ok(`RFC 9180 (HPKE, @hpke/core): ${escolhidos.length} suítes, ${n} operações`, escolhidos.length === 2 && n > 100 && erros.length === 0, erros.slice(0, 5).join("; "));
}

// ═══════════════════ 5. Leitura dos vetores das RFCs em texto ═══════════════════

/** Tira cabeçalho e rodapé de página do texto de uma RFC. */
const semPaginas = (texto) =>
  texto.replace(/\r/g, "").split("\n").filter((l) => !/\[Page \d+\]\s*$/.test(l) && !/^RFC \d{4}\s/.test(l) && !l.includes("\f"));

/** Os campos "nome = valor" ou "nome: valor" de um trecho, com as linhas de continuação (hexadecimal) juntadas. */
function campos(linhas) {
  const r = {};
  let atual = null;
  for (const l of linhas) {
    const m = /^\s{3}(\w+)\s*[:=]\s*([0-9a-f,]*)\s*$/.exec(l);
    if (m) {
      atual = m[1];
      r[atual] = m[2];
    } else if (atual && /^\s{3}[0-9a-f,]+\s*$/.test(l)) r[atual] += l.trim();
    else if (l.trim() !== "") atual = null;
  }
  return r;
}

// ═══════════════════ 6. RFC 9497 (OPRF), VOPRF P384-SHA384 ═══════════════════
{
  const linhas = semPaginas(await lerTexto("rfc/rfc9497.txt"));
  const ini = linhas.findIndex((l) => /^A\.4\.2\.  VOPRF Mode/.test(l));
  const fim = linhas.findIndex((l, i) => i > ini && /^A\.4\.3\./.test(l));
  const secao = linhas.slice(ini, fim);
  const cabecalho = campos(secao.slice(0, secao.findIndex((l) => /^A\.4\.2\.1\./.test(l))));
  const vetores = [];
  let inicio = -1;
  for (const [i, l] of secao.entries()) {
    if (/^A\.4\.2\.\d+\.  Test Vector/.test(l)) {
      if (inicio >= 0) vetores.push(campos(secao.slice(inicio, i)));
      inicio = i;
    }
  }
  if (inicio >= 0) vetores.push(campos(secao.slice(inicio)));
  const { Oprf, VOPRFClient, VOPRFServer, deriveKeyPair, generatePublicKey } = await import("@cloudflare/voprf-ts");
  const suite = Oprf.Suite.P384_SHA384;
  const erros = [];
  const par = await deriveKeyPair(Oprf.Mode.VOPRF, suite, h(cabecalho.Seed), h(cabecalho.KeyInfo));
  if (!iguais(par.privateKey, h(cabecalho.skSm))) erros.push("skSm");
  if (!iguais(generatePublicKey(suite, par.privateKey), h(cabecalho.pkSm))) erros.push("pkSm");
  const grupo = Oprf.getGroup(suite);
  for (const [i, v] of vetores.entries()) {
    const entradas = v.Input.split(",").map(h);
    const cegos = v.Blind.split(",").map((b) => grupo.desScalar(h(b)));
    const cliente = new VOPRFClient(suite, h(cabecalho.pkSm));
    let k = 0;
    cliente.randomBlinder = async () => cegos[k++];
    const [fin, pedido] = await cliente.blind(entradas);
    const cegosSerializados = pedido.blinded.map((e) => hx(e.serialize(true)));
    if (cegosSerializados.join(",") !== v.BlindedElement) erros.push(`BlindedElement ${i + 1}`);
    const servidor = new VOPRFServer(suite, par.privateKey);
    const avaliacao = await servidor.blindEvaluate(pedido);
    if (avaliacao.evaluated.map((e) => hx(e.serialize(true))).join(",") !== v.EvaluationElement) erros.push(`EvaluationElement ${i + 1}`);
    // finalize confere a prova DLEQ do servidor antes de devolver a saída.
    const saidas = await cliente.finalize(fin, avaliacao);
    if (saidas.map(hx).join(",") !== v.Output) erros.push(`Output ${i + 1}`);
  }
  ok(`RFC 9497 VOPRF P384-SHA384 (@cloudflare/voprf-ts): ${vetores.length} vetores`, vetores.length === 3 && erros.length === 0, erros.join("; "));
}

// ═══════════════════ 7. RFC 9578 (Privacy Pass), tipos 1 e 2 ═══════════════════
{
  const linhas = semPaginas(await lerTexto("rfc/rfc9578.txt"));
  const blocos = (ini, fim) => {
    const a = linhas.findIndex((l) => l.startsWith(ini));
    const b = linhas.findIndex((l, i) => i > a && l.startsWith(fim));
    const trecho = linhas.slice(a, b);
    const vs = [];
    let inicio = -1;
    for (const [i, l] of trecho.entries()) {
      if (/^\s+\/\/ Test vector \d+/.test(l)) {
        if (inicio >= 0) vs.push(campos(trecho.slice(inicio + 1, i)));
        inicio = i;
      }
    }
    if (inicio >= 0) vs.push(campos(trecho.slice(inicio + 1)));
    return vs;
  };
  const { privateVerif, publicVerif, Token } = await import("@cloudflare/privacypass-ts");

  // Tipo 1 (VOPRF): o que o servidor da Alumia faz hoje (emitir e conferir).
  const tipo1 = blocos("A.1.  Issuance Protocol 1", "A.2.  Issuance Protocol 2");
  const erros1 = [];
  for (const [i, v] of tipo1.entries()) {
    const emissor = new privateVerif.Issuer("issuer.example", h(v.skI), h(v.pkI));
    const pedido = privateVerif.TokenRequest.deserialize(h(v.token_request));
    if (!iguais(pedido.serialize(), h(v.token_request))) erros1.push(`pedido ${i + 1}`);
    const resposta = await emissor.issue(pedido);
    const ne = privateVerif.VOPRF.Ne;
    if (!iguais(resposta.serialize().subarray(0, ne), h(v.token_response).subarray(0, ne))) erros1.push(`avaliação ${i + 1}`);
    const passe = Token.deserialize(privateVerif.VOPRF, h(v.token));
    if (!(await privateVerif.verifyToken(passe, h(v.skI)))) erros1.push(`passe ${i + 1} recusado`);
    const torto = h(v.token);
    torto[torto.length - 1] ^= 1;
    if (await privateVerif.verifyToken(Token.deserialize(privateVerif.VOPRF, torto), h(v.skI)).catch(() => false)) erros1.push(`passe adulterado ${i + 1} aceito`);
  }
  ok(`RFC 9578 tipo 1 (VOPRF, @cloudflare/privacypass-ts): ${tipo1.length} vetores`, tipo1.length >= 3 && erros1.length === 0, erros1.join("; "));

  // Tipo 2 (RSA cego): a emissão é determinística (a assinatura cega é a mesma) e o passe confere com a chave pública.
  const tipo2 = blocos("A.2.  Issuance Protocol 2", "Acknowledgements");
  const erros2 = [];
  for (const [i, v] of tipo2.entries()) {
    const pem = Buffer.from(h(v.skI)).toString("utf8");
    const pkcs8 = createPrivateKey(pem).export({ format: "der", type: "pkcs8" });
    const alg = { name: "RSA-PSS", hash: "SHA-384" };
    const privada = await sutil.importKey("pkcs8", pkcs8, alg, true, ["sign"]);
    const publica = await sutil.importKey("spki", publicVerif.convertRSASSAPSSToEnc(h(v.pkI)), alg, true, ["verify"]);
    const emissor = new publicVerif.Issuer(publicVerif.BlindRSAMode.PSS, "issuer.example", privada, publica);
    const resposta = await emissor.issue(publicVerif.TokenRequest.deserialize(publicVerif.BLIND_RSA, h(v.token_request)));
    if (!iguais(resposta.serialize(), h(v.token_response))) erros2.push(`assinatura cega ${i + 1}`);
    const passe = Token.deserialize(publicVerif.BLIND_RSA, h(v.token));
    if (!(await emissor.verify(passe))) erros2.push(`passe ${i + 1} recusado`);
    const torto = h(v.token);
    torto[torto.length - 1] ^= 1;
    if (await emissor.verify(Token.deserialize(publicVerif.BLIND_RSA, torto)).catch(() => false)) erros2.push(`passe adulterado ${i + 1} aceito`);
  }
  ok(`RFC 9578 tipo 2 (RSA cego, @cloudflare/privacypass-ts): ${tipo2.length} vetores`, tipo2.length >= 3 && erros2.length === 0, erros2.join("; "));
}

console.log(`${certos} certos, ${falhas.length} falhas`);
for (const f of falhas) console.log(`  ✗ ${f}`);
process.exit(falhas.length ? 1 : 0);
