// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, item 1.1: o ML-KEM-768 de DENTRO do SPQR (o `libcrux-ml-kem` 0.0.10, formalmente verificado), no mesmo WebAssembly, contra
// os vetores do FIPS 203 e contra outra implementação (@noble/post-quantum):
//   - os vetores acumulados da biblioteca padrão do Go (go1.25.0, src/crypto/mlkem/mlkem_test.go, TestAccumulated): 10 000 testes
//     sorteados por um SHAKE-128 de entrada vazia (semente d‖z, m e um cifrado inválido); ek, ct, k e o k do cifrado inválido
//     (rejeição implícita) vão a um SHAKE-128 corrido, cujo resumo publicado para o ML-KEM-768 é o de baixo. (O mesmo procedimento
//     descrito no C2SP/CCTV, que acrescenta o dk, não bateu com o resumo listado lá, nem no libcrux nem no @noble: fica de fora.)
//   - os mesmos sorteios dão os mesmos ek, dk, ct e k no @noble/post-quantum (300 casos);
//   - chave pública fora do módulo (a conferência do FIPS 203, seção 7.2) é recusada.
// Usa o build de TESTE do módulo (as funções mlkem_* só existem nele; o do site não as tem):
//   cd nativo/spqr-wasm && cargo build --release --locked --target wasm32-unknown-unknown --features teste --target-dir target/teste
// Uso: node scripts/testar-r3-pq-vetores.mjs
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { shake128 } from "@noble/hashes/sha3.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

const ARQUIVO = fileURLToPath(new URL("../nativo/spqr-wasm/target/teste/wasm32-unknown-unknown/release/alumia_spqr_wasm.wasm", import.meta.url));
/** Go, go1.25.0, src/crypto/mlkem/mlkem_test.go, TestAccumulated (ML-KEM-768, 10 000 testes). */
const ESPERADO_10000 = "8a518cc63da366322a8e7a818c7a0d63483cb3528d34a4cf42f35d5ad73f22fc";

let certos = 0;
const falhas = [];
const confere = (nome, ok, detalhe = "") => (ok ? certos++ : falhas.push(`${nome}${detalhe ? `: ${detalhe}` : ""}`));

if (!fs.existsSync(ARQUIVO)) {
  console.log(`falta o build de teste do SPQR (${ARQUIVO}); veja o cabeçalho deste arquivo`);
  process.exit(1);
}
let mem;
const { instance } = await WebAssembly.instantiate(fs.readFileSync(ARQUIVO), {
  env: { aleatorio: (p, n) => globalThis.crypto.getRandomValues(new Uint8Array(mem.buffer, p, n)) },
});
const w = instance.exports;
mem = w.memory;
const por = (b) => {
  const p = w.reservar(b.length);
  new Uint8Array(mem.buffer, p, b.length).set(b);
  return p;
};
const saida = () => {
  const b = new Uint8Array(mem.buffer, w.saida_ptr(), w.saida_len()).slice();
  w.limpar();
  const r = [];
  const v = new DataView(b.buffer);
  for (let i = 0; i < b.length; ) {
    const n = v.getUint32(i, true);
    r.push(b.slice(i + 4, i + 4 + n));
    i += 4 + n;
  }
  return r;
};
const libcrux = {
  par(dz) {
    const p = por(dz);
    const ok = w.mlkem_par(p);
    w.soltar(p, 64);
    if (ok !== 0) throw new Error("par");
    const [ek, dk] = saida();
    return { ek, dk };
  },
  encapsular(ek, m) {
    const a = por(ek);
    const b = por(m);
    const ok = w.mlkem_encapsular(a, ek.length, b);
    w.soltar(a, ek.length);
    w.soltar(b, 32);
    if (ok !== 0) return null;
    const [ct, k] = saida();
    return { ct, k };
  },
  decapsular(dk, ct) {
    const a = por(dk);
    const b = por(ct);
    const ok = w.mlkem_decapsular(a, dk.length, b, ct.length);
    w.soltar(a, dk.length);
    w.soltar(b, ct.length);
    if (ok !== 0) throw new Error("decapsular");
    return saida()[0];
  },
};
const iguais = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const hex = (b) => Buffer.from(b).toString("hex");

// Os vetores acumulados.
{
  const rng = shake128.create({});
  let lido = 0;
  // O SHAKE-128 como fluxo: xof() devolve os próximos bytes.
  const tirar = (n) => {
    lido += n;
    return rng.xof(n);
  };
  const acumulado = shake128.create({ dkLen: 32 });
  let decapsBate = true;
  let comNoble = true;
  const t0 = Date.now();
  for (let i = 0; i < 10_000; i++) {
    const d = tirar(32);
    const z = tirar(32);
    const m = tirar(32);
    const ctRuim = tirar(1088);
    const dz = new Uint8Array(64);
    dz.set(d);
    dz.set(z, 32);
    const { ek, dk } = libcrux.par(dz);
    const { ct, k } = libcrux.encapsular(ek, m);
    const k2 = libcrux.decapsular(dk, ct);
    const kRuim = libcrux.decapsular(dk, ctRuim);
    if (!iguais(k, k2)) decapsBate = false;
    acumulado.update(ek).update(ct).update(k).update(kRuim);
    if (i < 300) {
      const n = ml_kem768.keygen(dz);
      const e = ml_kem768.encapsulate(n.publicKey, m);
      if (!iguais(n.publicKey, ek) || !iguais(n.secretKey, dk) || !iguais(e.cipherText, ct) || !iguais(e.sharedSecret, k) || !iguais(ml_kem768.decapsulate(ctRuim, n.secretKey), kRuim)) comNoble = false;
    }
  }
  const resumo = hex(acumulado.digest().subarray(0, 32));
  confere("FIPS 203 (10 000 vetores acumulados do ML-KEM-768, os da biblioteca do Go): o libcrux de dentro do SPQR bate", resumo === ESPERADO_10000, resumo);
  confere("FIPS 203: decapsular o cifrado certo dá a mesma chave do encapsular (10 000 vezes)", decapsBate);
  confere("FIPS 203: o @noble/post-quantum dá os mesmos ek, dk, ct e k, e a mesma rejeição implícita (300 casos)", comNoble);
  console.log(`  (10 000 vetores em ${Date.now() - t0} ms; ${lido} bytes do sorteio determinístico)`);
}

// Chave pública fora do módulo (coeficiente ≥ 3329): o encapsular recusa (FIPS 203, 7.2, "modulus check").
{
  const { ek } = libcrux.par(new Uint8Array(64).fill(7));
  const torta = Uint8Array.from(ek);
  torta[0] = 0xff;
  torta[1] |= 0x0f;
  confere("FIPS 203: chave pública com coeficiente fora do módulo é recusada", libcrux.encapsular(torta, new Uint8Array(32)) === null);
  confere("FIPS 203: chave pública de tamanho errado é recusada", libcrux.encapsular(ek.subarray(0, 1183), new Uint8Array(32)) === null);
}

console.log(`${certos} certos, ${falhas.length} falhas`);
if (falhas.length) {
  for (const f of falhas) console.log(`  FALHA ${f}`);
  process.exit(1);
}
