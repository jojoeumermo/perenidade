// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O carimbo de tempo do registro de abuso (Prompt 4, item 10): um pedido RFC 3161 (Time-Stamp Protocol) a um serviço público de
// carimbo, feito pelo SERVIDOR do site (app/api/alumia/carimbo), nunca pelo aparelho. Ao serviço vai só o SHA-256 do arquivo: nem
// o arquivo, nem a conta, nem o endereço de quem pediu. A resposta (DER) volta inteira para o aparelho, que a cifra junto do
// arquivo para a assessoria jurídica; quem recebe confere com o certificado do serviço (por exemplo, `openssl ts -verify`).
//
// Aqui só o mínimo de DER: montar o TimeStampReq (versão 1, SHA-256, nonce, certReq) e, na resposta, ler o status, conferir que o
// carimbo traz o mesmo resumo e o mesmo nonce, e achar a hora (genTime). A assinatura do serviço NÃO é conferida aqui (isso pede o
// certificado do serviço e CMS completo): a tela diz que a conferência é de quem recebe.
// Sem os atalhos "@/" de propósito: roda no Node nos testes.

/**
 * O serviço público de carimbo: o endereço (https) em ALUMIA_CARIMBO_URL, no servidor do site. A escolha do serviço é da
 * coordenação: sem a variável, não há carimbo (desligado), e o registro sai só com o resumo e a hora do aparelho, o que a tela diz.
 */
export function servicoDoCarimbo(valor: string | undefined): URL | null {
  if (!valor) return null;
  try {
    const u = new URL(valor.trim());
    return u.protocol === "https:" && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

const SHA256_OID = [0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01];

function tamanhoDer(n: number): number[] {
  if (n < 0x80) return [n];
  const bytes: number[] = [];
  for (let x = n; x > 0; x >>= 8) bytes.unshift(x & 0xff);
  return [0x80 | bytes.length, ...bytes];
}
const tlv = (tag: number, conteudo: number[]): number[] => [tag, ...tamanhoDer(conteudo.length), ...conteudo];

/** O TimeStampReq em DER para um SHA-256 (32 bytes) e um nonce de 8 bytes (positivo). */
export function pedidoDeCarimbo(resumo: Uint8Array, nonce: Uint8Array): Uint8Array {
  if (resumo.length !== 32 || nonce.length !== 8) throw new Error("invalido");
  const n = Array.from(nonce);
  n[0] = (n[0] & 0x7f) | 0x01; // positivo e sem zero à esquerda (DER mínimo)
  const algoritmo = tlv(0x30, [...SHA256_OID, 0x05, 0x00]);
  const impressao = tlv(0x30, [...algoritmo, ...tlv(0x04, Array.from(resumo))]);
  return new Uint8Array(tlv(0x30, [...tlv(0x02, [0x01]), ...impressao, ...tlv(0x02, n), 0x01, 0x01, 0xff]));
}

/** O nonce como ele vai no pedido (o mesmo ajuste do primeiro byte). */
export function nonceDoPedido(nonce: Uint8Array): Uint8Array {
  const n = Uint8Array.from(nonce);
  n[0] = (n[0] & 0x7f) | 0x01;
  return n;
}

interface Tlv {
  tag: number;
  inicio: number;
  fim: number;
  conteudo: number;
}

function lerTlv(b: Uint8Array, i: number): Tlv | null {
  if (i + 2 > b.length) return null;
  const tag = b[i];
  let n = b[i + 1];
  let j = i + 2;
  if (n & 0x80) {
    const k = n & 0x7f;
    if (k === 0 || k > 4 || j + k > b.length) return null;
    n = 0;
    for (let x = 0; x < k; x++) n = n * 256 + b[j + x];
    j += k;
  }
  if (j + n > b.length) return null;
  return { tag, inicio: i, fim: j + n, conteudo: j };
}

const contem = (b: Uint8Array, agulha: Uint8Array, de = 0): number => {
  fora: for (let i = de; i + agulha.length <= b.length; i++) {
    for (let j = 0; j < agulha.length; j++) if (b[i + j] !== agulha[j]) continue fora;
    return i;
  }
  return -1;
};

export type Conferencia = { ok: true; token: Uint8Array; hora: string } | { ok: false; motivo: "formato" | "recusado" | "resumo" | "nonce" | "hora" };

/**
 * Lê a TimeStampResp: status 0 ou 1 (concedido), o carimbo presente, com o MESMO resumo e o MESMO nonce do pedido, e a hora
 * (GeneralizedTime do TSTInfo, a primeira depois do resumo). Devolve o carimbo (o timeStampToken, em DER) e a hora em ISO.
 */
export function lerRespostaDoCarimbo(resposta: Uint8Array, resumo: Uint8Array, nonce: Uint8Array): Conferencia {
  const fora = lerTlv(resposta, 0);
  if (!fora || fora.tag !== 0x30 || fora.fim !== resposta.length) return { ok: false, motivo: "formato" };
  const status = lerTlv(resposta, fora.conteudo);
  if (!status || status.tag !== 0x30) return { ok: false, motivo: "formato" };
  const valor = lerTlv(resposta, status.conteudo);
  if (!valor || valor.tag !== 0x02 || valor.fim - valor.conteudo !== 1) return { ok: false, motivo: "formato" };
  if (resposta[valor.conteudo] > 1) return { ok: false, motivo: "recusado" };
  const token = lerTlv(resposta, status.fim);
  if (!token || token.tag !== 0x30) return { ok: false, motivo: "formato" };
  const corpo = resposta.subarray(token.inicio, token.fim);
  const ondeResumo = contem(corpo, Uint8Array.from([0x04, 0x20, ...resumo]));
  if (ondeResumo < 0) return { ok: false, motivo: "resumo" };
  const n = nonceDoPedido(nonce);
  if (contem(corpo, Uint8Array.from([0x02, n.length, ...n]), ondeResumo) < 0) return { ok: false, motivo: "nonce" };
  // A hora: o primeiro GeneralizedTime (tag 0x18) depois do resumo, no formato AAAAMMDDhhmmss[.fração]Z.
  for (let i = ondeResumo + 34; i < corpo.length - 2; i++) {
    if (corpo[i] !== 0x18) continue;
    const t = lerTlv(corpo, i);
    if (!t) continue;
    const texto = String.fromCharCode(...corpo.subarray(t.conteudo, t.fim));
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\.\d+)?Z$/.exec(texto);
    if (!m) continue;
    const hora = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7] ? m[7].slice(0, 4) : ""}Z`;
    if (Number.isNaN(Date.parse(hora))) continue;
    return { ok: true, token: corpo.slice(), hora };
  }
  return { ok: false, motivo: "hora" };
}

/** O resumo veio como 64 letras hexadecimais? Devolve os 32 bytes, ou nulo. */
export function resumoDeHex(hex: unknown): Uint8Array | null {
  if (typeof hex !== "string" || !/^[0-9a-f]{64}$/.test(hex)) return null;
  const saida = new Uint8Array(32);
  for (let i = 0; i < 32; i++) saida[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return saida;
}
