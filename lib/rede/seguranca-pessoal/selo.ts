// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, segurança pessoal (itens 10, 11 e 12): o registro de abuso e o pedido do plantão (para a assessoria jurídica da
// organização) e o aviso do interruptor de sumiço (para um contato de confiança) saem do aparelho cifrados para a CHAVE DE SEGURANÇA
// de quem vai ler (supabase/migracoes/20261127-p4-seguranca-pessoal.sql).
//
// A chave de segurança é PRÓPRIA desta finalidade: não é a chave de voto, nem a de pedidos, nem a de aparelho. Um par X-Wing
// (X25519 + ML-KEM-768) criado no aparelho de quem vai ler, pela MESMA biblioteca e a MESMA construção HPKE do chat (RFC 9180, modo
// base, @hpke/core + @hpke/hybridkem-x-wing, HKDF-SHA-256, AES-256-GCM: como lib/rede/membros/entrada.ts e
// lib/rede/chat/r2/pedido.ts). A pública vai ao banco assinada pela identidade da conta (Ed25519, a do chat novo); a privada fica só
// no aparelho (guarda.ts). Nenhum protocolo novo e nada do voto muda.
//
//   conteúdo  uma chave AES-256-GCM sorteada por envio (Web Crypto, como lib/anexos.ts):  iv(12) ‖ AES-GCM(dados, aad = contexto)
//   embrulho  a chave do conteúdo, por HPKE, para a chave de segurança de cada leitora:   enc(1120) ‖ seal(32 + 16) = 1168 bytes
//             info = rótulo do embrulho; aad = finalidade, envio e a conta de quem lê
// O contexto amarra cada cifra à finalidade e ao envio, e o embrulho à conta de quem lê: o banco não troca um pedido por outro nem
// entrega o embrulho de uma advogada a outra. O servidor só vê o tamanho (o pedido e o aviso têm tamanho fixo; o registro vai em
// degraus de 256 KiB).
// Sem os atalhos "@/" de propósito: o teste (scripts/testar-p4-seguranca-pessoal.mjs) roda este arquivo direto no Node.
import type { CipherSuite } from "@hpke/core";
import { ed25519 } from "@noble/curves/ed25519.js";

/** Os rótulos desta frente (prefixo próprio; o teste confere que nenhum repete os do chat, do voto ou dos membros). */
export const ROTULOS = {
  chave: "alumia/p4/seguranca/chave/v1",
  registro: "alumia/p4/seguranca/registro/v1",
  plantao: "alumia/p4/seguranca/plantao/v1",
  sumico: "alumia/p4/seguranca/sumico/v1",
  embrulho: "alumia/p4/seguranca/embrulho/v1",
  // A ficha de filiação do lote ação coletiva (item 99, lib/rede/coletiva/filiacao.ts): a mesma construção, só o rótulo próprio.
  filiacao: "alumia/p4/seguranca/filiacao/v1",
} as const;

export type Finalidade = "registro" | "plantao" | "sumico" | "filiacao";

export const TAMANHOS = {
  publica: 1216,
  identidade: 32,
  assinatura: 64,
  enc: 1120,
  chave: 32,
  iv: 12,
  etiqueta: 16,
  embrulho: 1120 + 32 + 16,
  /** O pedido do plantão vai sempre com o mesmo tamanho (o servidor não sabe se a pessoa escreveu muito ou pouco). */
  plantao: 2048,
  /** O aviso do sumiço também. */
  sumico: 4096,
  /** O registro (foto ou vídeo) vai em degraus deste tamanho. */
  degrau: 256 * 1024,
  /** O maior arquivo do registro (o banco aceita a cifra até 9 MiB). */
  arquivo: 8 * 1024 * 1024,
} as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const utf8 = new TextEncoder();
const deUtf8 = new TextDecoder("utf-8", { fatal: true });
type Buf = Uint8Array<ArrayBuffer>;
const buf = (b: Uint8Array): Buf => (b.buffer instanceof ArrayBuffer && b.byteOffset === 0 && b.byteLength === b.buffer.byteLength ? (b as Buf) : (Uint8Array.from(b) as Buf));

export function juntar(...partes: Uint8Array[]): Uint8Array {
  const saida = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    saida.set(p, i);
    i += p.length;
  }
  return saida;
}

/** Base64 comum (com "="), o que o banco decodifica com decode(..., 'base64'). */
export function paraBase64(bytes: Uint8Array): string {
  let t = "";
  for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(t);
}
export function deBase64(texto: unknown): Uint8Array | null {
  if (typeof texto !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(texto.replace(/\s+/g, ""))) return null;
  try {
    const cru = atob(texto.replace(/\s+/g, ""));
    const saida = new Uint8Array(cru.length);
    for (let i = 0; i < cru.length; i++) saida[i] = cru.charCodeAt(i);
    return saida;
  } catch {
    return null;
  }
}

let suite: Promise<CipherSuite> | null = null;
function suiteDaSeguranca(): Promise<CipherSuite> {
  suite ??= (async () => {
    const [{ CipherSuite: Suite, HkdfSha256, Aes256Gcm }, { XWing }] = await Promise.all([import("@hpke/core"), import("@hpke/hybridkem-x-wing")]);
    return new Suite({ kem: new XWing(), kdf: new HkdfSha256(), aead: new Aes256Gcm() });
  })().catch((e: unknown) => {
    suite = null;
    throw e;
  });
  return suite;
}

// ───────────────────────── A chave de segurança ─────────────────────────

export interface ParDeSeguranca {
  publica: Uint8Array;
  privada: Uint8Array;
}

/** Um par novo (a privada fica só no aparelho). */
export async function novaChaveDeSeguranca(): Promise<ParDeSeguranca> {
  const s = await suiteDaSeguranca();
  const par = await s.kem.generateKeyPair();
  return {
    publica: new Uint8Array(await s.kem.serializePublicKey(par.publicKey)),
    privada: new Uint8Array(await s.kem.serializePrivateKey(par.privateKey)),
  };
}

/** O texto que a identidade da conta assina: rótulo, conta e a pública inteira. */
export function textoDaChave(conta: string, publica: Uint8Array): Uint8Array {
  if (!UUID.test(conta)) throw new Error("invalido");
  return juntar(utf8.encode(`${ROTULOS.chave}\n${conta}\n`), publica);
}

/** A chave de segurança está assinada pela identidade desta conta? */
export function conferirChave(identidade: Uint8Array, conta: string, publica: Uint8Array, assinatura: Uint8Array): boolean {
  try {
    if (identidade.length !== TAMANHOS.identidade || publica.length !== TAMANHOS.publica || assinatura.length !== TAMANHOS.assinatura) return false;
    return ed25519.verify(assinatura, textoDaChave(conta.toLowerCase(), publica), identidade);
  } catch {
    return false;
  }
}

/** Uma destinatária como o banco a entrega: a conta, a identidade, a chave de segurança e a assinatura dela (base64). */
export interface DestinoDoBanco {
  conta: string;
  identidade: string;
  publica: string;
  assinatura: string;
}

export interface Destino {
  conta: string;
  identidade: Uint8Array;
  publica: Uint8Array;
}

/**
 * Confere cada destinatária que o banco entregou: a chave tem de estar assinada pela identidade da conta. Uma que não confere fica de
 * fora; nenhuma que confira: lista vazia (a tela diz que não dá para mandar). Quem chama ainda confere a identidade no registro de
 * transparência (cliente.ts), para o servidor não pôr uma identidade inventada.
 */
export function destinosConferidos(lista: unknown): Destino[] {
  if (!Array.isArray(lista)) return [];
  const saida: Destino[] = [];
  for (const d of lista as Partial<DestinoDoBanco>[]) {
    const conta = typeof d?.conta === "string" ? d.conta.toLowerCase() : "";
    const identidade = deBase64(d?.identidade);
    const publica = deBase64(d?.publica);
    const assinatura = deBase64(d?.assinatura);
    if (!UUID.test(conta) || !identidade || !publica || !assinatura) continue;
    if (!conferirChave(identidade, conta, publica, assinatura)) continue;
    if (saida.some((x) => x.conta === conta)) continue;
    saida.push({ conta, identidade, publica });
  }
  return saida;
}

// ───────────────────────── Selar e abrir ─────────────────────────

/** O contexto do conteúdo (rótulo e envio) e o do embrulho (finalidade, envio e a conta de quem lê). Os campos não têm "\n". */
function contexto(finalidade: Finalidade, id: string, conta?: string): Uint8Array {
  if (!(finalidade in ROTULOS) || !UUID.test(id) || (conta !== undefined && !UUID.test(conta))) throw new Error("invalido");
  return conta === undefined ? utf8.encode(`${ROTULOS[finalidade]}\n${id}`) : utf8.encode(`${finalidade}\n${id}\n${conta}`);
}

/** Completa até `tamanho` com zeros, depois de 4 bytes com o tamanho de verdade. */
export function preencher(dados: Uint8Array, tamanho: number): Uint8Array {
  if (dados.length + 4 > tamanho) throw new Error("grande_demais");
  const saida = new Uint8Array(tamanho);
  new DataView(saida.buffer).setUint32(0, dados.length);
  saida.set(dados, 4);
  return saida;
}

/** O contrário de preencher. Tamanho que não cabe: nulo. */
export function tirarPreenchimento(dados: Uint8Array): Uint8Array | null {
  if (dados.length < 4) return null;
  const n = new DataView(dados.buffer, dados.byteOffset, dados.byteLength).getUint32(0);
  if (n > dados.length - 4) return null;
  return dados.slice(4, 4 + n);
}

/** O degrau do registro: o próximo múltiplo de 256 KiB que cabe os dados e os 4 bytes do tamanho. */
export const degrauDoRegistro = (n: number) => Math.ceil((n + 4) / TAMANHOS.degrau) * TAMANHOS.degrau;

export interface Selado {
  cifra: Uint8Array;
  embrulhos: { conta: string; embrulho: Uint8Array }[];
}

/** Cifra `dados` uma vez, com uma chave sorteada, e embrulha a chave para cada destinatária. */
export async function selar(finalidade: Finalidade, id: string, destinos: Pick<Destino, "conta" | "publica">[], dados: Uint8Array): Promise<Selado> {
  if (!destinos.length) throw new Error("sem_destino");
  const s = await suiteDaSeguranca();
  const crua = crypto.getRandomValues(new Uint8Array(TAMANHOS.chave));
  try {
    const chave = await crypto.subtle.importKey("raw", crua, "AES-GCM", false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(TAMANHOS.iv));
    const cifra = juntar(iv, new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: buf(contexto(finalidade, id)) }, chave, buf(dados))));
    const embrulhos: Selado["embrulhos"] = [];
    for (const d of destinos) {
      if (d.publica.length !== TAMANHOS.publica) throw new Error("chave_invalida");
      const pk = await s.kem.deserializePublicKey(buf(d.publica));
      const { ct, enc } = await s.seal({ recipientPublicKey: pk, info: buf(utf8.encode(ROTULOS.embrulho)) }, crua, buf(contexto(finalidade, id, d.conta)));
      embrulhos.push({ conta: d.conta, embrulho: juntar(new Uint8Array(enc), new Uint8Array(ct)) });
    }
    return { cifra, embrulhos };
  } finally {
    crua.fill(0);
  }
}

/** Abre com a privada da chave de segurança de quem lê. Chave errada, contexto errado, bytes mexidos: nulo (nunca lança). */
export async function abrir(finalidade: Finalidade, id: string, conta: string, privada: Uint8Array, embrulho: Uint8Array, cifra: Uint8Array): Promise<Uint8Array | null> {
  let crua: Uint8Array | null = null;
  try {
    if (embrulho.length !== TAMANHOS.embrulho || cifra.length < TAMANHOS.iv + TAMANHOS.etiqueta) return null;
    const s = await suiteDaSeguranca();
    const sk = await s.kem.deserializePrivateKey(buf(privada));
    crua = new Uint8Array(await s.open(
      { recipientKey: sk, enc: buf(embrulho.slice(0, TAMANHOS.enc)), info: buf(utf8.encode(ROTULOS.embrulho)) },
      buf(embrulho.slice(TAMANHOS.enc)),
      buf(contexto(finalidade, id, conta.toLowerCase())),
    ));
    if (crua.length !== TAMANHOS.chave) return null;
    const chave = await crypto.subtle.importKey("raw", buf(crua), "AES-GCM", false, ["decrypt"]);
    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf(cifra.slice(0, TAMANHOS.iv)), additionalData: buf(contexto(finalidade, id)) }, chave, buf(cifra.slice(TAMANHOS.iv))));
  } catch {
    return null;
  } finally {
    crua?.fill(0);
  }
}

// ───────────────────────── O que vai dentro de cada envio ─────────────────────────

/** O que aconteceu, para o plantão: só de uma lista (o texto de cada um está nos textos da tela). */
export const OCORRIDOS = ["detencao", "abordagem_violenta", "agressao", "ameaca", "objetos_tomados", "pessoa_ferida", "outro"] as const;
export type Ocorrido = (typeof OCORRIDOS)[number];
/** Como a assessoria responde: o contato que a pessoa escolheu. */
export const CONTATOS = ["alumia", "telefone", "outra_pessoa"] as const;
export type TipoDeContato = (typeof CONTATOS)[number];

export interface PedidoDoPlantao {
  v: 1;
  onde: string;
  ocorrido: Ocorrido;
  contato: { tipo: TipoDeContato; valor: string };
}

const limpar = (t: unknown, max: number) => (typeof t === "string" ? t.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max) : "");

/** Monta o pedido do plantão com só os campos mínimos (onde, o que, o contato), já preenchido até o tamanho fixo. */
export function pedidoDoPlantao(onde: string, ocorrido: Ocorrido, contato: { tipo: TipoDeContato; valor: string }): Uint8Array {
  if (!OCORRIDOS.includes(ocorrido) || !CONTATOS.includes(contato?.tipo)) throw new Error("invalido");
  const p: PedidoDoPlantao = { v: 1, onde: limpar(onde, 200), ocorrido, contato: { tipo: contato.tipo, valor: limpar(contato.valor, 120) } };
  if (!p.onde || !p.contato.valor) throw new Error("invalido");
  return preencher(utf8.encode(JSON.stringify(p)), TAMANHOS.plantao);
}

/** Lê o pedido aberto. Qualquer coisa fora do formato: nulo. */
export function lerPedidoDoPlantao(aberto: Uint8Array): PedidoDoPlantao | null {
  try {
    const p = JSON.parse(deUtf8.decode(tirarPreenchimento(aberto) ?? new Uint8Array())) as PedidoDoPlantao;
    if (p?.v !== 1 || !OCORRIDOS.includes(p.ocorrido) || !CONTATOS.includes(p.contato?.tipo)) return null;
    return { v: 1, onde: limpar(p.onde, 200), ocorrido: p.ocorrido, contato: { tipo: p.contato.tipo, valor: limpar(p.contato.valor, 120) } };
  } catch {
    return null;
  }
}

/** A ficha do registro de abuso, que vai cifrada junto do arquivo. O local e o contato só entram se a pessoa escolher. */
export interface FichaDoRegistro {
  v: 1;
  tipo: "foto" | "video";
  formato: string;
  /** O SHA-256 do arquivo, em hexadecimal: o que o carimbo de tempo assina. */
  resumo: string;
  /** A resposta do serviço de carimbo (RFC 3161, o carimbo em DER, base64) e a hora que ele diz. Sem carimbo: nulos. */
  carimbo: string | null;
  carimbo_em: string | null;
  carimbo_servico: string | null;
  /** A hora do aparelho quando o arquivo foi feito (o carimbo é a prova; esta é só a informação). */
  feito_em: string;
  local?: string;
  contato?: string;
}

const FORMATOS = /^(image\/(jpeg|png|webp|heic|heif)|video\/(mp4|webm|quicktime|3gpp))$/;

/** Junta a ficha e o arquivo num só bloco (4 bytes com o tamanho da ficha, a ficha em JSON, o arquivo), preenchido até o degrau. */
export function pacoteDoRegistro(ficha: FichaDoRegistro, arquivo: Uint8Array): Uint8Array {
  if (arquivo.length === 0 || arquivo.length > TAMANHOS.arquivo) throw new Error("grande_demais");
  if (ficha.v !== 1 || (ficha.tipo !== "foto" && ficha.tipo !== "video") || !FORMATOS.test(ficha.formato) || !/^[0-9a-f]{64}$/.test(ficha.resumo)) throw new Error("invalido");
  const f: FichaDoRegistro = {
    v: 1, tipo: ficha.tipo, formato: ficha.formato, resumo: ficha.resumo,
    carimbo: ficha.carimbo ?? null, carimbo_em: ficha.carimbo_em ?? null, carimbo_servico: ficha.carimbo_servico ?? null, feito_em: limpar(ficha.feito_em, 40),
  };
  const local = limpar(ficha.local, 200);
  const contato = limpar(ficha.contato, 120);
  if (local) f.local = local;
  if (contato) f.contato = contato;
  const j = utf8.encode(JSON.stringify(f));
  const bloco = juntar(new Uint8Array(4), j, arquivo);
  new DataView(bloco.buffer).setUint32(0, j.length);
  return preencher(bloco, degrauDoRegistro(bloco.length));
}

/** O contrário de pacoteDoRegistro. */
export function lerPacoteDoRegistro(aberto: Uint8Array): { ficha: FichaDoRegistro; arquivo: Uint8Array } | null {
  try {
    const bloco = tirarPreenchimento(aberto);
    if (!bloco || bloco.length < 4) return null;
    const n = new DataView(bloco.buffer, bloco.byteOffset, bloco.byteLength).getUint32(0);
    if (n > bloco.length - 4 || n > 64 * 1024) return null;
    const ficha = JSON.parse(deUtf8.decode(bloco.subarray(4, 4 + n))) as FichaDoRegistro;
    if (ficha?.v !== 1 || (ficha.tipo !== "foto" && ficha.tipo !== "video") || !FORMATOS.test(ficha.formato) || !/^[0-9a-f]{64}$/.test(ficha.resumo)) return null;
    return { ficha, arquivo: bloco.slice(4 + n) };
  } catch {
    return null;
  }
}

/** O SHA-256 em hexadecimal (Web Crypto: existe no navegador e no Node). */
export async function resumoHex(dados: Uint8Array): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", buf(dados)));
  return Array.from(h, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** O aviso do sumiço: de quem (o @ que a pessoa quer que apareça) e o texto (até 1000 letras), preenchido até o tamanho fixo. */
export interface AvisoDoSumico {
  v: 1;
  de: string;
  texto: string;
}

export function avisoDoSumico(de: string, texto: string): Uint8Array {
  const t = typeof texto === "string" ? texto.replace(/\r\n/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, 1000) : "";
  const d = limpar(de, 60);
  if (!t || !d) throw new Error("invalido");
  return preencher(utf8.encode(JSON.stringify({ v: 1, de: d, texto: t } satisfies AvisoDoSumico)), TAMANHOS.sumico);
}

export function lerAvisoDoSumico(aberto: Uint8Array): AvisoDoSumico | null {
  try {
    const a = JSON.parse(deUtf8.decode(tirarPreenchimento(aberto) ?? new Uint8Array())) as AvisoDoSumico;
    if (a?.v !== 1 || typeof a.de !== "string" || typeof a.texto !== "string") return null;
    return { v: 1, de: limpar(a.de, 60), texto: a.texto.slice(0, 1000) };
  } catch {
    return null;
  }
}
