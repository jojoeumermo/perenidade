// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A cerimônia dos segredos do servidor (onda R3, 2.6): uma ferramenta pública e genérica, para fazer numa máquina SEM REDE, com
// várias pessoas na sala. Nenhuma pessoa escolhe o segredo sozinha, e nenhuma o guarda sozinha.
//
//   1. Cada pessoa sorteia 32 bytes no PRÓPRIO aparelho:          node scripts/segredos/cerimonia.mjs contribuir
//      e lê em voz alta (ou digita na máquina da cerimônia) as 64 letras que saem.
//   2. Na máquina da cerimônia, juntam-se as contribuições NA ORDEM combinada:
//         node scripts/segredos/cerimonia.mjs juntar --versao 2 --k 3 --n 5 <contribuição 1> <contribuição 2> ...
//      O segredo é HKDF-SHA-256(contribuições em ordem, sal "alumia/r3/cerimonia/v1", info "segredo:v<versão>", 32 bytes): basta uma
//      contribuição ser sorteada de verdade para o segredo ser imprevisível. Sai UMA vez o valor para o ambiente do servidor
//      ("v<versão>:<base64url>") e N partes (Shamir, K de N, pela shamir-secret-sharing, auditada), cada uma com o número dela e 24
//      palavras (BIP-39, pela @scure/bip39). Cada pessoa leva UMA parte, escrita à mão. K−1 partes juntas não dizem nada do segredo.
//   3. Para recuperar (servidor perdido): K pessoas juntam as partes:
//         node scripts/segredos/cerimonia.mjs refazer --versao 2 --conferencia <16 letras> "<n>: <24 palavras>" "<n>: <24 palavras>" ...
//      A conferência (16 letras, escritas em cada parte na cerimônia) diz se o que saiu é o segredo: o Shamir sozinho não avisa.
//   LIMITE: o limiar protege a GERAÇÃO e a GUARDA. Em uso, o servidor tem o segredo inteiro no ambiente (não há limiar em uso).
//
// Nada é gravado em disco por esta ferramenta. A rotação (trocar a versão, deixar a anterior valer na troca) está em
// lib/rede/painel/impressao.ts e lib/rede/fediverso/cifra.ts. Sem os atalhos "@/": roda direto no Node.
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { entropyToMnemonic, mnemonicToEntropy } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { combine, split } from "shamir-secret-sharing";

export const ROTULOS = { cerimonia: "alumia/r3/cerimonia/v1", conferencia: "alumia/r3/cerimonia/conferencia/v1" };
const enc = new TextEncoder();

/** Uma contribuição: 32 bytes sorteados neste aparelho, em 64 letras hexadecimais. */
export const contribuir = () => randomBytes(32).toString("hex");

/** O segredo a partir das contribuições, na ordem (duas ou mais, de 32 bytes cada). */
export function juntarContribuicoes(contribuicoes, versao) {
  if (!Array.isArray(contribuicoes) || contribuicoes.length < 2) throw new Error("poucas_contribuicoes");
  if (!Number.isInteger(versao) || versao < 2 || versao > 32767) throw new Error("versao_invalida");
  const bytes = contribuicoes.map((c) => {
    if (typeof c !== "string" || !/^[0-9a-f]{64}$/i.test(c)) throw new Error("contribuicao_invalida");
    return Buffer.from(c, "hex");
  });
  if (new Set(bytes.map((b) => b.toString("hex"))).size !== bytes.length) throw new Error("contribuicao_repetida");
  return hkdf(sha256, Buffer.concat(bytes), enc.encode(ROTULOS.cerimonia), enc.encode(`segredo:v${versao}`), 32);
}

/** O valor para o ambiente do servidor: "v<versão>:<base64url>". */
export const paraOAmbiente = (segredo, versao) => `v${versao}:${Buffer.from(segredo).toString("base64url")}`;

/**
 * A conferência do segredo (16 letras): HMAC-SHA-256 do segredo com um rótulo próprio, cortado em 8 bytes. Sai junto com as partes e
 * vai escrita em CADA parte. Não diz nada do segredo (é um resumo com chave dele mesmo). Serve para, ao refazer, saber se o resultado é
 * o segredo: com K−1 partes, ou com uma parte errada mas de palavras válidas (a soma do BIP-39 só pega erro de digitação), o Shamir
 * devolve OUTRO número sem avisar (auditoria interna da R3).
 */
export const conferenciaDe = (segredo) => Buffer.from(hmac(sha256, segredo, enc.encode(ROTULOS.conferencia)).subarray(0, 8)).toString("hex");

/** As N partes (K para refazer), cada uma com o número dela e 24 palavras. */
export async function dividir(segredo, k, n) {
  if (!(segredo instanceof Uint8Array) || segredo.length !== 32) throw new Error("segredo_invalido");
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 2 || n < k || n > 20) throw new Error("k_de_n_invalido");
  const partes = await split(segredo, n, k);
  // A biblioteca põe a coordenada (o número da parte) no último byte; os 32 de antes viram as 24 palavras.
  return partes.map((p) => ({ numero: p[32], palavras: entropyToMnemonic(p.subarray(0, 32), wordlist) }));
}

/** Lê "n: palavras…" (ou {numero, palavras}) de volta para os 33 bytes da parte. */
export function lerParte(parte) {
  const { numero, palavras } = typeof parte === "string" ? (() => {
    const m = /^\s*(\d{1,3})\s*:\s*(.+)$/.exec(parte);
    if (!m) throw new Error("parte_invalida");
    return { numero: Number(m[1]), palavras: m[2] };
  })() : parte;
  if (!Number.isInteger(numero) || numero < 1 || numero > 255) throw new Error("parte_invalida");
  const bytes = mnemonicToEntropy(palavras.trim().toLowerCase().split(/\s+/).join(" "), wordlist);
  if (bytes.length !== 32) throw new Error("parte_invalida");
  return Uint8Array.from([...bytes, numero]);
}

/**
 * Refaz o segredo com K partes (ou mais). Com menos que K, ou com uma parte errada, o Shamir devolve outro número qualquer: por isso,
 * com a `conferencia` (as 16 letras escritas em cada parte), o resultado é conferido e, se não for o segredo, recusado
 * ("partes_nao_conferem"). A linha de comando EXIGE a conferência.
 */
export async function refazer(partes, conferencia) {
  if (!Array.isArray(partes) || partes.length < 2) throw new Error("poucas_partes");
  const segredo = await combine(partes.map(lerParte));
  if (conferencia !== undefined) {
    if (typeof conferencia !== "string" || !/^[0-9a-f]{16}$/i.test(conferencia)) throw new Error("conferencia_invalida");
    if (conferenciaDe(segredo) !== conferencia.toLowerCase()) {
      segredo.fill(0);
      throw new Error("partes_nao_conferem");
    }
  }
  return segredo;
}

// ── A linha de comando ─────────────────────────────────────────────────────────────────────────────────────────────────────
async function principal(args) {
  const [acao, ...resto] = args;
  const opcao = (nome) => {
    const i = resto.indexOf(`--${nome}`);
    if (i < 0) return null;
    const v = Number(resto[i + 1]);
    resto.splice(i, 2);
    return v;
  };
  if (acao === "contribuir") {
    console.log(contribuir());
  } else if (acao === "juntar") {
    const versao = opcao("versao"), k = opcao("k"), n = opcao("n");
    const segredo = juntarContribuicoes(resto, versao);
    console.log(`Para o ambiente do servidor (uma vez; não guarde em arquivo):\n${paraOAmbiente(segredo, versao)}\n`);
    const conf = conferenciaDe(segredo);
    console.log(`Conferência (escreva em CADA parte; não é segredo): ${conf}\n`);
    for (const p of await dividir(segredo, k, n)) console.log(`Parte ${p.numero} (de ${n}; ${k} refazem; conferência ${conf}):\n${p.numero}: ${p.palavras}\n`);
    segredo.fill(0);
  } else if (acao === "refazer") {
    const versao = opcao("versao");
    const i = resto.indexOf("--conferencia");
    if (i < 0) throw new Error("falta --conferencia (as 16 letras escritas em cada parte)");
    const conferencia = resto[i + 1];
    resto.splice(i, 2);
    const segredo = await refazer(resto, conferencia);
    console.log(paraOAmbiente(segredo, versao));
    segredo.fill(0);
  } else {
    console.log("Uso: cerimonia.mjs contribuir | juntar --versao N --k K --n N <contribuições> | refazer --versao N --conferencia C \"<n>: <palavras>\" ...");
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  principal(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
