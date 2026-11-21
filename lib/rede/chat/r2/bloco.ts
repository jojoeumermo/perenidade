// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Bloco r2: o que vai DENTRO da cifra da conversa a dois (Proteus, lib/rede/chat/r2/proteus.ts), e portanto que o servidor nunca
// vê. Documento: docs/rede/CHAT-PRIVADO.md.
//
//   versão (1) = 2 | tipo (1) | conversa (16) | id (16) | contador (8) | anterior (32) | prazo (1) | kf (32) | comprimento (4) | corpo
//
// - conversa: sorteada no pedido de conversa; o servidor não a conhece.
// - id: sorteado por mensagem (o identificador de dentro do cifrado).
// - contador: por aparelho que escreve e por conversa, começa em 1 e nunca se repete; com o `anterior` (o resumo do bloco anterior
//   deste aparelho nesta conversa) dá os avisos de "faltou mensagem", "fora de ordem" e "repetida" (lib/rede/chat/r2/ordem.ts).
// - prazo: 1, 7 ou 30 dias (some do aparelho depois disso).
// - kf: a chave da franquia, sorteada POR CÓPIA (cada aparelho de destino recebe outra): quem denuncia mostra o kf e prova que o
//   texto passou pela caixa (docs/rede/CHAT-PRIVADO.md, denúncia com prova). O compromisso é calculado sobre o bloco SEM o kf.
// - tipo e versão ficam dentro do cifrado autenticado: um tipo de mensagem não passa por outro.
import { canonico, copia, deB64Url, juntar, lerU32, paraB64Url, resumo, sortear, texto, u32, type Bytes } from "./bytes";
import { ROTULOS } from "./rotulos";

export const VERSAO_DO_BLOCO = 2;
export const TIPOS = { texto: 1, controle: 2, anexo: 3, caixas: 4 } as const;
export type TipoDoBloco = keyof typeof TIPOS;
export type Prazo = 1 | 7 | 30;
const PRAZOS: readonly number[] = [1, 7, 30];
/** O maior corpo aceito (2000 caracteres de até 4 bytes e os campos do corpo cabem; o envelope maior tem 32 KB). */
export const MAIOR_CORPO = 24 * 1024;
const CABECALHO = 1 + 1 + 16 + 16 + 8 + 32 + 1 + 32 + 4;
const KF_EM = 75;
export const NADA_ANTES: Bytes = new Uint8Array(new ArrayBuffer(32));

export interface Bloco {
  tipo: TipoDoBloco;
  conversa: Bytes;
  id: Bytes;
  contador: number;
  anterior: Bytes;
  prazo: Prazo;
  kf: Bytes;
  corpo: Bytes;
}

function contadorEm8(n: number): Bytes {
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("contador_invalido");
  return juntar(u32(Math.floor(n / 2 ** 32)), u32(n % 2 ** 32));
}

/** Monta um bloco novo; `id` e `kf` são sorteados aqui. */
export function novoBloco(campos: Omit<Bloco, "id" | "kf">): Bloco {
  return { ...campos, id: sortear(16), kf: sortear(32) };
}

export function montar(b: Bloco): Bytes {
  if (b.conversa.length !== 16 || b.id.length !== 16 || b.anterior.length !== 32 || b.kf.length !== 32) throw new Error("bloco_invalido");
  if (!PRAZOS.includes(b.prazo)) throw new Error("prazo_invalido");
  if (b.corpo.length > MAIOR_CORPO) throw new Error("conteudo_grande");
  return juntar(new Uint8Array([VERSAO_DO_BLOCO, TIPOS[b.tipo]]), b.conversa, b.id, contadorEm8(b.contador), b.anterior, new Uint8Array([b.prazo]), b.kf, u32(b.corpo.length), b.corpo);
}

/** Lê um bloco; null em qualquer coisa fora do formato (versão, tipo, prazo, comprimento, sobra). */
export function ler(bytes: Uint8Array): Bloco | null {
  if (bytes.length < CABECALHO || bytes[0] !== VERSAO_DO_BLOCO) return null;
  const tipo = (Object.keys(TIPOS) as TipoDoBloco[]).find((t) => TIPOS[t] === bytes[1]);
  if (!tipo) return null;
  const contador = lerU32(bytes, 34) * 2 ** 32 + lerU32(bytes, 38);
  if (!Number.isSafeInteger(contador) || contador < 1) return null;
  const prazo = bytes[74];
  if (!PRAZOS.includes(prazo)) return null;
  const n = lerU32(bytes, 107);
  if (n > MAIOR_CORPO || CABECALHO + n !== bytes.length) return null;
  return {
    tipo,
    conversa: copia(bytes.subarray(2, 18)),
    id: copia(bytes.subarray(18, 34)),
    contador,
    anterior: copia(bytes.subarray(42, 74)),
    prazo: prazo as Prazo,
    kf: copia(bytes.subarray(KF_EM, KF_EM + 32)),
    corpo: copia(bytes.subarray(CABECALHO)),
  };
}

/** O bloco sem o kf: é sobre ele que o compromisso da franquia é calculado. */
export function semKf(bytes: Uint8Array): Bytes {
  return juntar(bytes.subarray(0, KF_EM), bytes.subarray(KF_EM + 32));
}

/**
 * O resumo de um bloco, que vai no `anterior` do bloco seguinte do mesmo aparelho. Sem o kf: a cópia de cada aparelho de destino
 * tem kf diferente, e a cadeia precisa ser a mesma para todos.
 */
export const resumoDoBloco = (bytes: Uint8Array): Bytes => resumo(canonico(ROTULOS.bloco, semKf(bytes)));

/** Corpo de texto (com o que a tela precisa). */
export interface CorpoDeTexto {
  t: string;
  /** Resposta a uma mensagem (o id de dentro do cifrado, 16 bytes em base64url). */
  r?: string;
  /** "Ver uma vez": quem recebe vê e a mensagem some; quem manda não guarda cópia. */
  umaVez?: boolean;
  /** Temporária: some em tantos minutos (1 a 1440) em vez do prazo da conversa. */
  minutos?: number;
  /**
   * Encaminhada (Prompt 4, item 14): quantas vezes este texto já foi encaminhado até aqui (1 a 255), contado DENTRO do cifrado; o
   * servidor não fica sabendo. A regra do freio está em lib/rede/chat/encaminhar.ts.
   */
  enc?: number;
}

const COM_RESPOSTA = 1;
const UMA_VEZ = 2;
const COM_MINUTOS = 4;
const ENCAMINHADA = 8;

/**
 * O corpo de texto em bytes: marcas (1 byte: 1 = resposta, 2 = ver uma vez, 4 = temporária, 8 = encaminhada), o id respondido (16
 * bytes, se houver), os minutos (2 bytes, se houver), a contagem de encaminhamentos (1 byte, se houver) e o texto em UTF-8, na forma
 * NFC, CRU (sem JSON nem escape). É o contrato com a denúncia com prova (lib/rede/caixas/franquia.ts, trechoNoConteudo): o trecho
 * denunciado tem de estar byte a byte dentro do bloco (o texto encaminhado também).
 */
export function corpoDeTexto(c: CorpoDeTexto): Bytes {
  const t = texto(c.t.normalize("NFC"));
  const partes: Uint8Array[] = [];
  let marcas = 0;
  if (c.r) {
    const r = deB64Url(c.r);
    if (r.length !== 16) throw new Error("resposta_invalida");
    marcas |= COM_RESPOSTA;
    partes.push(r);
  }
  if (c.umaVez) marcas |= UMA_VEZ;
  if (c.minutos !== undefined) {
    if (!Number.isInteger(c.minutos) || c.minutos < 1 || c.minutos > 1440) throw new Error("minutos_invalidos");
    marcas |= COM_MINUTOS;
    partes.push(new Uint8Array([c.minutos >> 8, c.minutos & 0xff]));
  }
  if (c.enc !== undefined) {
    if (!Number.isInteger(c.enc) || c.enc < 1 || c.enc > 255) throw new Error("encaminhada_invalida");
    marcas |= ENCAMINHADA;
    partes.push(new Uint8Array([c.enc]));
  }
  return juntar(new Uint8Array([marcas]), ...partes, t);
}
export function lerCorpoDeTexto(corpo: Uint8Array): CorpoDeTexto | null {
  if (corpo.length < 1 || corpo[0] & ~(COM_RESPOSTA | UMA_VEZ | COM_MINUTOS | ENCAMINHADA)) return null;
  const marcas = corpo[0];
  let i = 1;
  let r: string | undefined;
  let minutos: number | undefined;
  let enc: number | undefined;
  if (marcas & COM_RESPOSTA) {
    if (corpo.length < i + 16) return null;
    r = paraB64Url(corpo.subarray(i, i + 16));
    i += 16;
  }
  if (marcas & COM_MINUTOS) {
    if (corpo.length < i + 2) return null;
    minutos = (corpo[i] << 8) | corpo[i + 1];
    if (minutos < 1 || minutos > 1440) return null;
    i += 2;
  }
  if (marcas & ENCAMINHADA) {
    if (corpo.length < i + 1 || corpo[i] < 1) return null;
    enc = corpo[i];
    i += 1;
  }
  let t: string;
  try {
    t = new TextDecoder("utf-8", { fatal: true }).decode(corpo.subarray(i));
  } catch {
    return null;
  }
  if (t !== t.normalize("NFC")) return null;
  return { t, ...(r ? { r } : {}), ...(marcas & UMA_VEZ ? { umaVez: true } : {}), ...(minutos ? { minutos } : {}), ...(enc ? { enc } : {}) };
}
