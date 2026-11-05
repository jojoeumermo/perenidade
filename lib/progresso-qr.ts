// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

// Levar o progresso e as anotações de um aparelho a outro, sem conta, por QR (ou por um código digitado).
//
// O aparelho de origem monta o pacote com o que a cópia de segurança já leva (lib/estudo.ts), comprime e cifra NO PRÓPRIO
// APARELHO (AES-GCM de 128 bits, chave aleatória, vetor novo a cada pacote). Dois caminhos:
//   1. cabe no QR: o QR leva o pacote cifrado e a chave. Nenhum servidor participa.
//   2. não cabe: o pacote já cifrado vai para o banco (public.progresso_qr_guardar, supabase/migracoes/2026-11-progresso-qr.sql),
//      que só guarda o texto cifrado, o entrega uma vez (apagando-o na leitura) e o descarta em até 1 dia. O QR leva só o
//      código do pacote (10 caracteres) e a chave. A chave NUNCA vai ao servidor.
// O outro aparelho lê o QR (ou o código digitado), decifra e JUNTA com o que já tem: nada do que está lá é apagado.
//
// Formatos (texto do QR e código digitado):
//   QR com o pacote   "lucia:progresso:1:<chave>:<pacote>"    chave = 26 caracteres do alfabeto abaixo; pacote = base64url(vetor ‖ cifrado)
//   QR com o código   "lucia:progresso:2:<código><chave>"     código = 10 caracteres; chave = 26
//   código digitado   "<código><chave>" (36 caracteres; espaços, traços e minúsculas valem)
// Alfabeto: letras e números sem 0, 1, I e O, para não confundir ao anotar (o mesmo do Sigilo).
//
// Sem os atalhos "@/" de propósito: scripts/testar-progresso-qr.mjs roda este arquivo direto no Node. Não lê disco nem o
// navegador além do WebCrypto (e, se existir, do CompressionStream); nada aqui entra no layout raiz.

import { restaurarCopia, entraNaCopia } from "./estudo";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
type Bytes = Uint8Array<ArrayBuffer>;

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const TAMANHO_DO_ID = 10;
const BYTES_DA_CHAVE = 16;
const CARACTERES_DA_CHAVE = 26; // 16 bytes = 128 bits = 26 caracteres de 5 bits (130 bits, os 2 últimos são zero)
export const FORMATO_ID = /^[A-HJ-NP-Z2-9]{10}$/;
/** O que o banco aceita: texto base64url, de 40 a 400 mil caracteres (igual ao check da tabela interno.progresso_qr). */
export const LIMITE_DO_SERVIDOR = 400_000;
/** Até quantos caracteres o texto do QR pode ter para a câmera de um celular ler sem sofrer (QR de versão 14 ou menor, correção M). */
export const LIMITE_DO_QR = 330;
const MAX_DESCOMPRIMIDO = 24_000_000;
const AAD = encoder.encode("instituto-lucia:progresso-qr:1");

const B64 = "[A-Za-z0-9_-]";
const FORMATO_BASE64 = new RegExp(`^${B64}+$`);
const FORMATO_CHAVE = new RegExp(`^[${ALFABETO}]{${CARACTERES_DA_CHAVE}}$`);
const FORMATO_QR_PACOTE = new RegExp(`^lucia:progresso:1:([${ALFABETO}]{${CARACTERES_DA_CHAVE}}):(${B64}{40,})$`);
const FORMATO_QR_CODIGO = new RegExp(`^lucia:progresso:2:([${ALFABETO}]{${TAMANHO_DO_ID}})([${ALFABETO}]{${CARACTERES_DA_CHAVE}})$`);

const paraBase64 = (bytes: Uint8Array) => {
  let texto = "";
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const deBase64 = (texto: string): Bytes => {
  const cru = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(cru.length));
  for (let i = 0; i < cru.length; i++) bytes[i] = cru.charCodeAt(i);
  return bytes;
};

// ───────────── Chave e código ─────────────

/** Chave nova: 16 bytes sorteados pelo aparelho. */
export const novaChaveBytes = (): Bytes => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(BYTES_DA_CHAVE)));

/** O código do pacote no servidor: 10 caracteres sorteados sem viés (32 símbolos dividem 256 por igual). */
export function novoId(): string {
  const sorteio = crypto.getRandomValues(new Uint8Array(TAMANHO_DO_ID));
  return Array.from(sorteio, (b) => ALFABETO[b % 32]).join("");
}

/** 16 bytes viram 26 caracteres do alfabeto (5 bits cada). */
export function chaveParaTexto(chave: Uint8Array): string {
  if (chave.length !== BYTES_DA_CHAVE) throw new Error("tamanho_invalido");
  let bits = 0;
  let acumulado = 0;
  let saida = "";
  for (const byte of chave) {
    acumulado = (acumulado << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(acumulado >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acumulado &= (1 << bits) - 1;
  }
  if (bits > 0) saida += ALFABETO[(acumulado << (5 - bits)) & 31];
  return saida;
}

/** O caminho de volta; null se o texto não tem o formato de uma chave. */
export function chaveDeTexto(texto: string): Bytes | null {
  if (!FORMATO_CHAVE.test(texto)) return null;
  const bytes = new Uint8Array(new ArrayBuffer(BYTES_DA_CHAVE));
  let bits = 0;
  let acumulado = 0;
  let n = 0;
  for (const letra of texto) {
    acumulado = (acumulado << 5) | ALFABETO.indexOf(letra);
    bits += 5;
    if (bits >= 8 && n < BYTES_DA_CHAVE) {
      bytes[n++] = (acumulado >>> (bits - 8)) & 255;
      bits -= 8;
    }
    acumulado &= (1 << bits) - 1;
  }
  return n === BYTES_DA_CHAVE ? bytes : null;
}

const limpar = (texto: string) => texto.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** O código para digitar, em grupos de 4 ("ABCD EFGH ..."), para ler em voz alta ou copiar à mão. */
export const codigoDigitavel = (id: string, chave: Uint8Array) => (id + chaveParaTexto(chave)).match(/.{1,4}/g)!.join(" ");

/** Lê o que a pessoa digitou. Aceita minúsculas, espaços e traços. null se o tamanho ou os símbolos não servem. */
export function lerCodigoDigitado(texto: string): { id: string; chave: Bytes } | null {
  const limpo = limpar(texto);
  if (limpo.length !== TAMANHO_DO_ID + CARACTERES_DA_CHAVE) return null;
  const id = limpo.slice(0, TAMANHO_DO_ID);
  const chave = chaveDeTexto(limpo.slice(TAMANHO_DO_ID));
  return FORMATO_ID.test(id) && chave ? { id, chave } : null;
}

// ───────────── Textos do QR ─────────────

export const qrComPacote = (chave: Uint8Array, pacote: string) => `lucia:progresso:1:${chaveParaTexto(chave)}:${pacote}`;
export const qrComCodigo = (id: string, chave: Uint8Array) => `lucia:progresso:2:${id}${chaveParaTexto(chave)}`;
/** O pacote cabe num QR legível? */
export const cabeNoQr = (texto: string) => texto.length <= LIMITE_DO_QR;

export type QrLido = { tipo: "pacote"; chave: Bytes; pacote: string } | { tipo: "codigo"; id: string; chave: Bytes };

/** Lê o texto de um QR. null se não for do progresso. */
export function lerQr(texto: string): QrLido | null {
  const t = texto.trim();
  const a = FORMATO_QR_PACOTE.exec(t);
  if (a) {
    const chave = chaveDeTexto(a[1]);
    return chave ? { tipo: "pacote", chave, pacote: a[2] } : null;
  }
  const b = FORMATO_QR_CODIGO.exec(t);
  if (b) {
    const chave = chaveDeTexto(b[2]);
    return chave ? { tipo: "codigo", id: b[1], chave } : null;
  }
  return null;
}

// ───────────── Compressão ─────────────

async function lerTudo(fluxo: ReadableStream<Uint8Array>): Promise<Bytes> {
  const leitor = fluxo.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.length;
    if (total > MAX_DESCOMPRIMIDO) {
      await leitor.cancel();
      throw new Error("grande_demais");
    }
    pedacos.push(value);
  }
  const saida = new Uint8Array(new ArrayBuffer(total));
  let pos = 0;
  for (const p of pedacos) {
    saida.set(p, pos);
    pos += p.length;
  }
  return saida;
}

/** Primeiro byte: 0 = sem compressão, 1 = deflate. Sem CompressionStream no navegador, vai sem comprimir (e abre em qualquer um). */
async function comprimir(texto: string): Promise<Bytes> {
  const cru = encoder.encode(texto);
  let corpo: Uint8Array = cru;
  let marca = 0;
  if (typeof CompressionStream !== "undefined") {
    try {
      const fluxo = new Blob([cru]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      corpo = await lerTudo(fluxo);
      marca = 1;
    } catch {
      corpo = cru;
      marca = 0;
    }
  }
  const saida = new Uint8Array(new ArrayBuffer(corpo.length + 1));
  saida[0] = marca;
  saida.set(corpo, 1);
  return saida;
}

async function descomprimir(bytes: Uint8Array): Promise<string | null> {
  if (bytes.length < 1) return null;
  const corpo = bytes.subarray(1);
  if (bytes[0] === 0) return corpo.length > MAX_DESCOMPRIMIDO ? null : decoder.decode(corpo);
  if (bytes[0] !== 1 || typeof DecompressionStream === "undefined") return null;
  try {
    const fluxo = new Blob([corpo as Bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return decoder.decode(await lerTudo(fluxo));
  } catch {
    return null;
  }
}

// ───────────── Cifrar e abrir ─────────────

const importar = (chave: Uint8Array, usos: KeyUsage[]) => crypto.subtle.importKey("raw", chave as Bytes, { name: "AES-GCM" }, false, usos);

export interface Selado {
  chave: Bytes;
  /** base64url(vetor de 12 bytes ‖ texto cifrado): é isto que vai no QR ou para o servidor. */
  pacote: string;
}

/** Comprime e cifra os dados (chave e valor, como na cópia de segurança). A chave sai só daqui: quem a tem abre o pacote. */
export async function selarPacote(dados: Record<string, string>): Promise<Selado> {
  const chave = novaChaveBytes();
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const claro = await comprimir(JSON.stringify({ formato: "lucia-progresso", versao: 1, dados }));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: AAD }, await importar(chave, ["encrypt"]), claro));
  const junto = new Uint8Array(new ArrayBuffer(12 + cifrado.length));
  junto.set(iv, 0);
  junto.set(cifrado, 12);
  return { chave, pacote: paraBase64(junto) };
}

/** Abre o pacote. null se a chave não é a dele, se foi mexido ou se o conteúdo não tem o formato do progresso. */
export async function abrirPacote(chave: Uint8Array, pacote: string): Promise<Record<string, string> | null> {
  if (chave.length !== BYTES_DA_CHAVE || !FORMATO_BASE64.test(pacote) || pacote.length < 40 || pacote.length > LIMITE_DO_SERVIDOR) return null;
  try {
    const junto = deBase64(pacote);
    const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv: junto.subarray(0, 12), additionalData: AAD }, await importar(chave, ["decrypt"]), junto.subarray(12));
    const texto = await descomprimir(new Uint8Array(claro));
    if (texto === null) return null;
    const bruto: unknown = JSON.parse(texto);
    if (!bruto || typeof bruto !== "object") return null;
    const p = bruto as { formato?: unknown; versao?: unknown; dados?: unknown };
    if (p.formato !== "lucia-progresso" || p.versao !== 1 || !p.dados || typeof p.dados !== "object" || Array.isArray(p.dados)) return null;
    const dados: Record<string, string> = {};
    for (const [k, v] of Object.entries(p.dados)) if (typeof v === "string") dados[k] = v;
    return dados;
  } catch {
    return null;
  }
}

// ───────────── Montar e juntar ─────────────

type Armazenamento = Pick<Storage, "length" | "key" | "getItem">;

/** Os dados que viajam: as chaves que a tela de Meus dados também leva na cópia (a permitida decide), só texto, com tamanho limitado. */
export function montarDados(armazenamento: Armazenamento, permitida: (chave: string) => boolean = entraNaCopia): Record<string, string> {
  const dados: Record<string, string> = {};
  for (let i = 0; i < armazenamento.length; i++) {
    const chave = armazenamento.key(i);
    if (!chave || !permitida(chave)) continue;
    const valor = armazenamento.getItem(chave);
    if (valor && valor.length < 2_000_000) dados[chave] = valor;
  }
  return dados;
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => Boolean(x) && typeof x === "object" && !Array.isArray(x);
const JSON_OU_NULL = (texto: string | null): unknown => {
  if (texto === null) return undefined;
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
};

/**
 * Junta o que veio com o que já está neste aparelho, SEM apagar nada daqui:
 *  - listas de textos (aulas concluídas, vistas...) se unem;
 *  - listas com id, registros por item e o projeto da Escola se juntam como na cópia de segurança (vence o mais recente);
 *  - objetos comuns se juntam chave a chave, e no mesmo item fica o que já estava aqui;
 *  - o resto (escolhas, tema, últimos lugares): só entra se aqui ainda não há nada.
 * Devolve quantas chaves mudaram. `permitida` filtra o que entra (as chaves que a cópia de segurança aceita).
 */
export function juntarDados(
  dados: Record<string, string>,
  armazenamento: Pick<Storage, "getItem" | "setItem">,
  permitida: (chave: string) => boolean = entraNaCopia,
): number {
  const paraRestaurar: Record<string, string> = {};
  let n = 0;
  const gravar = (chave: string, valor: string) => {
    try {
      if (armazenamento.getItem(chave) === valor) return;
      armazenamento.setItem(chave, valor);
      n++;
    } catch {
      // sem espaço: segue com as outras
    }
  };
  for (const [chave, valor] of Object.entries(dados)) {
    if (!permitida(chave) || typeof valor !== "string" || valor.length >= 2_000_000) continue;
    const aqui = armazenamento.getItem(chave);
    if (aqui === null || aqui === "") {
      paraRestaurar[chave] = valor; // nada aqui: entra como veio (listas e registros passam pela mesma junção, que não perde nada)
      continue;
    }
    const a = JSON_OU_NULL(aqui);
    const b = JSON_OU_NULL(valor);
    if (Array.isArray(a) && Array.isArray(b) && [...a, ...b].every((x) => typeof x === "string")) {
      gravar(chave, JSON.stringify([...new Set([...(a as string[]), ...(b as string[])])]));
    } else if (Array.isArray(a) && Array.isArray(b) && ["lucia:caderno", "lucia:revisao", "lucia:erros", "lucia:escola:caderneta"].includes(chave)) {
      paraRestaurar[chave] = valor;
    } else if (ehObjeto(a) && ehObjeto(b)) {
      if (["lucia:testes", "lucia:exercicios", "lucia:concluidas-em", "lucia:nivelamento", "lucia:ajudou", "lucia:escola:projeto"].includes(chave)) paraRestaurar[chave] = valor;
      else gravar(chave, JSON.stringify({ ...b, ...a }));
    }
    // qualquer outro caso: o que está aqui fica
  }
  n += restaurarCopia({ formato: "lucia-copia", versao: 1, feita: "", dados: paraRestaurar }, armazenamento);
  return n;
}
