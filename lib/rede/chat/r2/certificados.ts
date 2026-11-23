// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem é quem na conversa a dois da onda R2 (itens 1.1 e 1.5): a identidade da conta, a chave de cada aparelho e os certificados que
// ligam uma à outra. Assinaturas Ed25519 da @noble/curves (auditada); resumos SHA-512 da @noble/hashes. Documento:
// docs/rede/CHAT-PRIVADO.md.
//
// - Identidade da conta (Ed25519): uma por pessoa, a mesma em todos os aparelhos dela (repassada ao ligar um aparelho, por QR). É
//   ela que entra no código de segurança (que por isso não muda quando a pessoa liga um aparelho novo) e no registro de
//   transparência.
// - Chave do aparelho (Ed25519): uma por aparelho, nunca sai dele. É o "nome" do aparelho no envelope e assina as chaves que ele
//   publica: a X-Wing da semana e as pré-chaves Proteus (o Proteus não assina pré-chave; a Alumia assina por fora, para o servidor não
//   conseguir trocar uma pré-chave sem o aparelho notar).
// - Certificado do aparelho: a identidade da conta assina "este aparelho, com esta identidade Proteus, é desta conta".
//
// Cada assinatura é sobre o texto canônico com o rótulo da finalidade (lib/rede/chat/r2/bytes.ts): uma assinatura de um uso nunca
// vale em outro. Toda conferência devolve booleano; nenhuma lança para "não confere".
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";
import { canonico, copia, iguais, juntar, sortear, texto, u32, type Bytes } from "./bytes";
import { ROTULOS, ROTULOS_DE_FORA } from "./rotulos";

export interface ParEd25519 {
  publica: Bytes;
  /** A semente de 32 bytes (fica só no aparelho, na loja cifrada). */
  privada: Bytes;
}

export function novoParEd25519(): ParEd25519 {
  const privada = sortear(32);
  return { privada, publica: copia(ed25519.getPublicKey(privada)) };
}

export const parDaSemente = (privada: Uint8Array): ParEd25519 => ({ privada: copia(privada), publica: copia(ed25519.getPublicKey(privada)) });

const assinar = (privada: Uint8Array, mensagem: Uint8Array) => copia(ed25519.sign(mensagem, privada));
function confere(publica: Uint8Array, mensagem: Uint8Array, assinatura: Uint8Array): boolean {
  if (publica.length !== 32 || assinatura.length !== 64) return false;
  try {
    // zip215: false = a regra estrita do RFC 8032 (sem assinaturas maleáveis).
    return ed25519.verify(assinatura, mensagem, publica, { zip215: false });
  } catch {
    return false;
  }
}

const diaEm4 = (dia: number) => u32(dia);

// ── Certificado do aparelho ─────────────────────────────────────────────────────────────────────────────────────────────────
export interface CertificadoDoAparelho {
  conta: string;
  aparelho: Bytes;
  proteus: string;
  /** Dias desde 1970 (UTC) em que o aparelho foi ligado. */
  criadoDia: number;
  assinatura: Bytes;
}

const textoDoCertificado = (conta: string, aparelho: Uint8Array, proteus: string, criadoDia: number) =>
  canonico(ROTULOS.certificadoAparelho, texto(conta), aparelho, texto(proteus), diaEm4(criadoDia));

/**
 * O dia que o certificado do aparelho leva: a SEGUNDA-FEIRA da semana (UTC), o mesmo que o banco grava (public.rede_diretorio_publicar,
 * 20261125-r3-fim.sql). O diretório é lido sem sessão, e o dia exato deixava quem está de fora acompanhar quando a pessoa troca de
 * aparelho (auditoria interna da R3). 1/1/1970 foi uma quinta: (dia + 3) % 7 é quantos dias depois da segunda.
 */
export const semanaDoCertificado = (ms: number) => {
  const d = Math.floor(ms / 86_400_000);
  return d - ((d + 3) % 7);
};

export function certificarAparelho(identidade: ParEd25519, conta: string, aparelho: Uint8Array, proteus: string, criadoDia: number): CertificadoDoAparelho {
  return { conta, aparelho: copia(aparelho), proteus, criadoDia, assinatura: assinar(identidade.privada, textoDoCertificado(conta, aparelho, proteus, criadoDia)) };
}

export const certificadoConfere = (identidade: Uint8Array, c: CertificadoDoAparelho) =>
  confere(identidade, textoDoCertificado(c.conta, c.aparelho, c.proteus, c.criadoDia), c.assinatura);

// ── Chave X-Wing da semana ──────────────────────────────────────────────────────────────────────────────────────────────────
const textoDaSemana = (aparelho: Uint8Array, xwing: Uint8Array, semana: number) => canonico(ROTULOS.chaveSemana, aparelho, xwing, u32(semana));
export const assinarChaveDaSemana = (aparelho: ParEd25519, xwing: Uint8Array, semana: number) => assinar(aparelho.privada, textoDaSemana(aparelho.publica, xwing, semana));
export const chaveDaSemanaConfere = (aparelho: Uint8Array, xwing: Uint8Array, semana: number, assinatura: Uint8Array) => confere(aparelho, textoDaSemana(aparelho, xwing, semana), assinatura);

// ── Pré-chaves Proteus ──────────────────────────────────────────────────────────────────────────────────────────────────────
const textoDaPreChave = (aparelho: Uint8Array, id: number, pkb: Uint8Array) => canonico(ROTULOS.preChave, aparelho, u32(id), pkb);
export const assinarPreChave = (aparelho: ParEd25519, id: number, pkb: Uint8Array) => assinar(aparelho.privada, textoDaPreChave(aparelho.publica, id, pkb));
export const preChaveConfere = (aparelho: Uint8Array, id: number, pkb: Uint8Array, assinatura: Uint8Array) => confere(aparelho, textoDaPreChave(aparelho, id, pkb), assinatura);

// ── Chave de pedidos da conta ───────────────────────────────────────────────────────────────────────────────────────────────
const textoDosPedidos = (conta: string, xwing: Uint8Array) => canonico(ROTULOS.chavePedidos, texto(conta), xwing);
export const assinarChaveDePedidos = (identidade: ParEd25519, conta: string, xwing: Uint8Array) => assinar(identidade.privada, textoDosPedidos(conta, xwing));
export const chaveDePedidosConfere = (identidade: Uint8Array, conta: string, xwing: Uint8Array, assinatura: Uint8Array) => confere(identidade, textoDosPedidos(conta, xwing), assinatura);

// ── Pedido de conversa ──────────────────────────────────────────────────────────────────────────────────────────────────────
/** A identidade de quem pede assina o pedido inteiro (o HPKE do modo base não autentica quem fechou o envelope). */
const textoDoPedido = (conteudo: Uint8Array) => canonico(ROTULOS.pedidoAssinado, conteudo);
export const assinarPedido = (identidade: ParEd25519, conteudo: Uint8Array) => assinar(identidade.privada, textoDoPedido(conteudo));
export const pedidoConfere = (identidade: Uint8Array, conteudo: Uint8Array, assinatura: Uint8Array) => confere(identidade, textoDoPedido(conteudo), assinatura);

// ── Declaração de quem escreve (contrato com a denúncia com prova, lib/rede/caixas/franquia.ts) ─────────────────────────────
/**
 * "O passe de depósito cujo resumo é pd_h, da caixa id_h, é meu": a identidade da conta de quem ESCREVE assina, e quem lê guarda
 * para a denúncia provar também a autoria. Os mesmos bytes de mensagemDaDeclaracao de lá (rótulo, id_h, pd_h, conta).
 */
const textoDaDeclaracao = (idH: Uint8Array, pdH: Uint8Array, conta: string) => {
  if (idH.length !== 32 || pdH.length !== 32) throw new Error("declaracao_invalida");
  return canonico(ROTULOS_DE_FORA.declaracao, idH, pdH, texto(conta));
};
export const assinarDeclaracao = (identidade: ParEd25519, idH: Uint8Array, pdH: Uint8Array, conta: string) => assinar(identidade.privada, textoDaDeclaracao(idH, pdH, conta));
export const declaracaoConfere = (identidade: Uint8Array, idH: Uint8Array, pdH: Uint8Array, conta: string, assinatura: Uint8Array) =>
  confere(identidade, textoDaDeclaracao(idH, pdH, conta), assinatura);

// ── Assinatura do voto em limiar (lib/rede/voto/limiar.ts) ─────────────────────────────────────────────────────────────────
/** O começo de todo texto que o voto assina com a identidade da conta (os rótulos de lib/rede/voto/limiar.ts). */
export const PREFIXO_DO_VOTO = "alumia/r2/voto/";
/**
 * Onda R3 (14): o certificado de folha dos grupos MLS da rede (lib/rede/grupos/certificado.ts) também é assinado pela identidade da
 * conta, pelo mesmo caminho (a fonte da identidade, lib/rede/voto/identidade.ts). O texto dele começa com este rótulo (no formato
 * canônico de bytes.ts: o rótulo e um byte zero).
 */
export const ROTULO_DA_FOLHA = "alumia/r3/folha-pacote/v1";
/**
 * Assina com a identidade da conta SÓ um texto do voto (que começa com o rótulo do voto) ou o certificado de uma folha dos grupos da
 * rede (que começa com o rótulo da folha, no formato canônico). A identidade nunca vira assinador genérico: um texto de outro uso
 * (certificado de aparelho, declaração, pedido) é recusado aqui.
 */
export function assinarTextoDoVoto(identidade: ParEd25519, t: Uint8Array): Uint8Array {
  const prefixo = texto(PREFIXO_DO_VOTO);
  const daFolha = canonico(ROTULO_DA_FOLHA);
  const comeca = (p: Uint8Array) => t.length > p.length && iguais(t.subarray(0, p.length), p);
  if (!comeca(prefixo) && !comeca(daFolha)) throw new Error("rotulo_errado");
  return assinar(identidade.privada, t);
}

// ── Código de segurança ─────────────────────────────────────────────────────────────────────────────────────────────────────
/** As voltas do SHA-512 de cada metade (as mesmas do código do Signal). */
export const VOLTAS_DO_CODIGO = 5200;

/** 30 algarismos de uma pessoa: SHA-512 iterado sobre (rótulo, conta, identidade); 6 grupos de 5 bytes, cada um módulo 100000. */
export function metadeDoCodigo(conta: string, identidade: Uint8Array): string {
  const inicio = canonico(ROTULOS.codigo, texto(conta), identidade);
  let h: Uint8Array = sha512(juntar(inicio, identidade));
  for (let i = 1; i < VOLTAS_DO_CODIGO; i++) h = sha512(juntar(h, identidade));
  let saida = "";
  for (let g = 0; g < 6; g++) {
    let n = 0;
    for (let k = 0; k < 5; k++) n = n * 256 + h[g * 5 + k];
    saida += String(n % 100000).padStart(5, "0");
  }
  return saida;
}

/**
 * O código de segurança de uma conversa: 60 algarismos, os 30 de cada pessoa, a menor metade primeiro (as duas pessoas veem o
 * mesmo código). É da IDENTIDADE da conta: não muda quando alguém liga um aparelho novo; muda se a identidade mudar.
 */
export function codigoDeSeguranca(a: { conta: string; identidade: Uint8Array }, b: { conta: string; identidade: Uint8Array }): string {
  const [x, y] = [metadeDoCodigo(a.conta, a.identidade), metadeDoCodigo(b.conta, b.identidade)].sort();
  return x + y;
}

export const mesmaChave = (a: Uint8Array, b: Uint8Array) => iguais(a, b);
