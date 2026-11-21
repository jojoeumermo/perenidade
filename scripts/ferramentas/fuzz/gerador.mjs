// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O gerador dos alvos de fuzzing: um sorteio com semente (para refazer exatamente o caso que derrubou um alvo) e os valores
// "maldosos" que entram pelas rotas e pelas funções do banco: JSON de qualquer forma, textos estranhos, números no limite, base64 de
// tamanho quase certo e mutações de um caso bom (trocar, apagar, duplicar e aninhar campos).
//
// A semente vem do sistema (crypto) quando não é dada; o sorteio em si é o xoshiro128** (rápido e reproduzível). Isto é ferramenta
// de teste: nada aqui sorteia segredo.
import crypto from "node:crypto";

/** Um sorteio reproduzível a partir de 16 bytes (hex). */
export function criarSorteio(sementeHex = crypto.randomBytes(16).toString("hex")) {
  const b = Buffer.from(sementeHex.padEnd(32, "0").slice(0, 32), "hex");
  let s = [b.readUInt32LE(0), b.readUInt32LE(4), b.readUInt32LE(8), b.readUInt32LE(12)];
  if (s.every((x) => x === 0)) s = [1, 2, 3, 4];
  const girar = (x, k) => ((x << k) | (x >>> (32 - k))) >>> 0;
  const proximo = () => {
    const r = Math.imul(girar(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = girar(s[3], 11);
    s = s.map((x) => x >>> 0);
    return r;
  };
  const r = {
    semente: sementeHex,
    /** Inteiro em [0, n). */
    ate: (n) => (n <= 1 ? 0 : proximo() % n),
    /** Verdadeiro com probabilidade p. */
    chance: (p) => proximo() / 2 ** 32 < p,
    escolher: (lista) => lista[r.ate(lista.length)],
    bytes: (n) => {
      const saida = Buffer.alloc(n);
      for (let i = 0; i < n; i++) saida[i] = proximo() & 0xff;
      return saida;
    },
  };
  return r;
}

const TEXTOS_ESTRANHOS = [
  "", " ", "\u0000", "a\u0000b", "\\x", "\\x00ff", "\\xzz", "null", "undefined", "NaN", "-0", "1e309", "0x10", "true",
  "'; drop table x; --", "\" or 1=1 --", "$1", "%s%s%s", "{}", "[]", "{\"a\":", "\ud800", "\udfff", "é", "👩🏽‍🦱", "ـ".repeat(50),
  "‮", "\r\n", "a".repeat(4097), "/".repeat(300), "../../etc/passwd", "<script>alert(1)</script>", "__proto__", "constructor",
  "00000000-0000-0000-0000-000000000000", "ffffffff-ffff-ffff-ffff-ffffffffffff", "2026-02-30", "9999-12-31T23:59:59Z", "-infinity",
  "PrivateToken token=", "Bearer x", "AAAA", "====", "-_-_", "+/+/",
];
const NUMEROS_ESTRANHOS = [0, -0, 1, -1, 2, 3, 0.5, -0.5, 255, 256, 2 ** 15, 2 ** 31 - 1, 2 ** 31, -(2 ** 31) - 1, 2 ** 32, 2 ** 53, 2 ** 53 + 2, 1e21, 1e308, -1e308, Number.MIN_VALUE];

/** base64url de n bytes sorteados (com chance de vir em base64 padrão, com "=" ou com um caractere a mais/menos). */
export function b64Quase(r, n) {
  const bytes = r.bytes(n);
  let t = r.chance(0.8) ? bytes.toString("base64url") : bytes.toString("base64");
  if (r.chance(0.05)) t += r.escolher(["=", "==", "*", " ", "\n"]);
  if (r.chance(0.05)) t = t.slice(1);
  return t;
}

/** Um texto maldoso. */
export function textoEstranho(r) {
  const k = r.ate(6);
  if (k === 0) return r.escolher(TEXTOS_ESTRANHOS);
  if (k === 1) return b64Quase(r, r.escolher([0, 1, 16, 31, 32, 33, 64, 2048, 3184]));
  if (k === 2) return r.bytes(r.ate(64)).toString("latin1");
  if (k === 3) return r.bytes(r.ate(32)).toString("hex");
  if (k === 4) return crypto.randomUUID();
  return String.fromCodePoint(...Array.from({ length: r.ate(20) }, () => r.ate(0x2ffff)).filter((c) => c < 0xd800 || c > 0xdfff));
}

/** Um valor JSON qualquer, com profundidade limitada (e, às vezes, muito fundo de propósito). */
export function jsonQualquer(r, fundo = 0) {
  const k = r.ate(fundo > 3 ? 5 : 8);
  if (k === 0) return null;
  if (k === 1) return r.chance(0.5);
  if (k === 2) return r.escolher(NUMEROS_ESTRANHOS) * (r.chance(0.5) ? 1 : -1);
  if (k === 3 || k === 4) return textoEstranho(r);
  if (k === 5) return Array.from({ length: r.ate(r.chance(0.05) ? 200 : 5) }, () => jsonQualquer(r, fundo + 1));
  if (k === 6 && r.chance(0.02)) {
    let v = {};
    for (let i = 0; i < 200; i++) v = { a: v };
    return v;
  }
  const o = {};
  for (let i = 0, n = r.ate(6); i < n; i++) por(o, r.chance(0.2) ? textoEstranho(r) : r.escolher(["id", "itens", "acao", "pd", "pl", "envelope", "cursor", "multi", "unico", "franquia", "__proto__", "constructor", "x"]), jsonQualquer(r, fundo + 1));
  return o;
}

/** Põe a chave como propriedade PRÓPRIA (com "__proto__", a atribuição comum trocaria o protótipo, como o JSON.parse não faz). */
function por(o, chave, valor) {
  Object.defineProperty(o, chave, { value: valor, enumerable: true, writable: true, configurable: true });
}

const copiar = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** Os caminhos (lista de chaves) de todos os nós de um valor JSON. */
function caminhos(v, atual = [], saida = []) {
  saida.push(atual);
  if (v && typeof v === "object") for (const k of Object.keys(v)) caminhos(v[k], [...atual, Array.isArray(v) ? Number(k) : k], saida);
  return saida;
}

/** Uma mutação de um caso bom: troca, apaga, duplica, aninha ou mexe nos bytes de um campo. */
export function mutar(r, original) {
  const v = copiar(original);
  const todos = caminhos(v);
  const alvo = r.escolher(todos);
  if (alvo.length === 0) return r.chance(0.5) ? jsonQualquer(r) : v;
  const pai = alvo.slice(0, -1).reduce((o, k) => o[k], v);
  const chave = alvo[alvo.length - 1];
  const atual = pai[chave];
  switch (r.ate(7)) {
    case 0:
      por(pai, chave, jsonQualquer(r));
      break;
    case 1:
      if (Array.isArray(pai)) pai.splice(chave, 1);
      else delete pai[chave];
      break;
    case 2:
      if (Array.isArray(pai)) pai.push(copiar(atual));
      else por(pai, `${chave}_`, copiar(atual));
      break;
    case 3:
      por(pai, chave, [copiar(atual)]);
      break;
    case 4:
      if (typeof atual === "string") {
        // mexe nos caracteres do texto (base64 com um caractere trocado, cortado ou crescido)
        const c = [...atual];
        const i = r.ate(Math.max(c.length, 1));
        const op = r.ate(3);
        if (op === 0) c[i] = r.escolher(["A", "_", "-", "=", "+", "/", "\u0000", "é"]);
        else if (op === 1) c.splice(i, 1);
        else c.splice(i, 0, ...r.bytes(r.ate(8) + 1).toString("base64url"));
        por(pai, chave, c.join(""));
      } else por(pai, chave, textoEstranho(r));
      break;
    case 5:
      por(pai, chave, typeof atual === "number" ? r.escolher(NUMEROS_ESTRANHOS) : typeof atual === "boolean" ? r.escolher([!atual, "true", 1, null]) : r.escolher(NUMEROS_ESTRANHOS));
      break;
    default:
      por(pai, chave, textoEstranho(r));
  }
  return v;
}
