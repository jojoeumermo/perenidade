// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat privado da Alumia, cifrado de ponta a ponta com a MESMA tecnologia das conversas da equipe (lib/sigilo.ts): chave de
// aparelho ECDH P-256 (privada não exportável), identidade ECDSA P-256 que certifica a chave do aparelho, chave AES-GCM-256 por
// versão da conversa embrulhada (ECDH + HKDF-SHA-256 + AES-GCM) para a chave de cada participante, e cada mensagem assinada pela
// identidade de quem escreve e cifrada no aparelho. O servidor (supabase/migracoes/20261106-t19-rede-chat-privado.sql) só guarda
// a parte pública, os embrulhos e o cifrado. Documento: docs/rede/CHAT-PRIVADO.md.
//
// Diferenças em relação às conversas da equipe, de propósito:
//   - Uma chave por conta (o aparelho em que a pessoa ativou o chat). A identidade NÃO é exportável e nunca sai do aparelho:
//     não há cópia de recuperação nem aprovação de outro aparelho. Trocar de aparelho = chave nova; o que foi escrito antes
//     só abre no aparelho antigo. Menos comodidade, menos coisa que possa vazar.
//   - Contextos próprios ("alumia-dm:..."): nada cifrado ou assinado aqui serve nas conversas da equipe, nem o contrário.
//
// Sem "@/" e sem navegador além do WebCrypto: roda no Node nos testes (scripts/testar-rede-chat.mjs).
import {
  abrirTexto, assinar, assinarTexto, type Autoria, cifrar, codigoDeSeguranca, decifrar, desembrulhar, embrulhar, FORMATO_PUBLICA, type Identidade, novaChave,
  novoAparelho, paraBase64, type ParDoAparelho, verificar, versaoDe,
} from "../sigilo";

export type { Autoria, Identidade, ParDoAparelho };
export { codigoDeSeguranca, versaoDe };

/** Quanto texto cabe numa mensagem (caracteres na tela). O cifrado, com assinatura, fica bem abaixo do teto do banco (12000). */
export const MAX_CARACTERES = 2000;
/** O teto em bytes UTF-8 (emoji e acento contam mais de um): 2000 caracteres de 4 bytes ainda cabem. */
const MAX_BYTES = 8000;

const ECDSA = { name: "ECDSA", namedCurve: "P-256" } as const;

/** A identidade do chat, criada no aparelho, NÃO exportável (a parte privada nunca sai, nem embrulhada). */
export async function novaIdentidadeDoChat(): Promise<Identidade> {
  const par = await crypto.subtle.generateKey(ECDSA, false, ["sign", "verify"]);
  return { privada: par.privateKey, publica: paraBase64(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey))) };
}

/** A chave do aparelho no chat: o mesmo par ECDH das conversas da equipe. */
export const novaChaveDoAparelho = novoAparelho;

/** O que o certificado afirma: "esta chave ECDH é a do chat desta pessoa". */
export const contextoDaChave = (usuario: string, publica: string) => `alumia-dm:chave:${usuario}:${publica}`;
/** O que amarra um embrulho: conversa, versão, para quem e para qual versão da chave de quem recebe. */
export const contextoDoEmbrulhoDoChat = (conversa: string, versao: number, para: string, chaveVersao: number) => `alumia-dm:embrulho:${conversa}:${versao}:${para}:${chaveVersao}`;
/** Onde cada mensagem mora: a conversa e quem escreveu (o banco não consegue mudar uma mensagem de conversa ou de autor). */
export const contextoDaMensagem = (conversa: string, autor: string) => `alumia-dm:mensagem:${conversa}:${autor}`;

export const certificarChave = (identidade: Identidade, usuario: string, publica: string) => assinar(identidade.privada, contextoDaChave(usuario, publica));

/** A chave do chat desta pessoa foi mesmo certificada pela identidade dela? */
export async function chaveCertificada(identidade: string, usuario: string, publica: string, certificado: string | null | undefined): Promise<boolean> {
  if (!certificado || !FORMATO_PUBLICA.test(identidade) || !FORMATO_PUBLICA.test(publica)) return false;
  return verificar(identidade, certificado, contextoDaChave(usuario, publica));
}

/** A chave pública de cada participante, como o servidor a entrega. */
export interface ChaveDeParticipante {
  usuario: string;
  identidade: string;
  publica: string;
  certificado: string;
  versao: number;
}

/** Um embrulho feito para mim, como o servidor o entrega. */
export interface EmbrulhoRecebido {
  versao: number;
  chave_versao: number;
  embrulho: string;
  de: string;
  de_publica: string;
  de_certificado: string;
}

/** Eu, neste aparelho. */
export interface Eu {
  usuario: string;
  aparelho: ParDoAparelho;
  identidade: Identidade;
  /** A versão da minha chave no servidor. */
  versao: number;
}

/**
 * Uma versão nova da chave da conversa, embrulhada para a chave atual de cada participante (eu e a outra pessoa). Só embrulha
 * para chave certificada pela identidade CONFIADA de cada um (`confiadas[usuario]`, guardada neste aparelho): o servidor não
 * consegue fazer este aparelho entregar a chave a uma chave falsa.
 */
export async function prepararNovaVersao(conversa: string, versao: number, eu: Eu, participantes: ChaveDeParticipante[], confiadas: Record<string, string>) {
  if (participantes.length !== 2) throw new Error("participantes");
  const chave = await novaChave();
  const embrulhos: { para: string; chave_versao: number; embrulho: string }[] = [];
  for (const p of participantes) {
    const identidade = confiadas[p.usuario];
    if (!identidade || identidade !== p.identidade) throw new Error("identidade_nao_confiada");
    if (!(await chaveCertificada(identidade, p.usuario, p.publica, p.certificado))) throw new Error("certificado_invalido");
    if (p.usuario === eu.usuario && p.publica !== eu.aparelho.publica) throw new Error("outro_aparelho");
    embrulhos.push({ para: p.usuario, chave_versao: p.versao, embrulho: await embrulhar(chave, eu.aparelho.privada, p.publica, contextoDoEmbrulhoDoChat(conversa, versao, p.usuario, p.versao)) });
  }
  return { chave, embrulhos };
}

/**
 * Abre um embrulho feito para mim. Só aceita se a chave de quem embrulhou foi certificada pela identidade CONFIADA dessa pessoa.
 * Devolve null em qualquer dúvida (embrulho de outra conversa, de outra versão, adulterado, de chave não certificada).
 */
export async function abrirEmbrulho(conversa: string, eu: Eu, e: EmbrulhoRecebido, confiadas: Record<string, string>): Promise<CryptoKey | null> {
  const identidade = confiadas[e.de];
  if (!identidade || !(await chaveCertificada(identidade, e.de, e.de_publica, e.de_certificado))) return null;
  return desembrulhar(e.embrulho, eu.aparelho.privada, e.de_publica, contextoDoEmbrulhoDoChat(conversa, e.versao, eu.usuario, e.chave_versao));
}

/** O texto cabe? (caracteres e bytes; vazio não vai). */
export function textoCabe(texto: string): boolean {
  const limpo = texto.trim();
  return limpo.length > 0 && [...limpo].length <= MAX_CARACTERES && new TextEncoder().encode(limpo).length <= MAX_BYTES;
}

/** Assina com a minha identidade e cifra com a chave da conversa, já no formato que o banco aceita ("c2.<versão>..."). */
export async function cifrarMensagem(chave: CryptoKey, versao: number, eu: Eu, conversa: string, texto: string): Promise<string> {
  if (!textoCabe(texto)) throw new Error("texto_grande");
  const lugar = contextoDaMensagem(conversa, eu.usuario);
  return cifrar(chave, versao, await assinarTexto(eu.identidade, texto.trim(), lugar, versao), lugar);
}

/** Decifra e confere a assinatura do autor. null = esta chave não abre (ou a mensagem foi adulterada ou mudada de lugar). */
export async function abrirMensagem(chave: CryptoKey, corpo: string, conversa: string, autor: string, identidadeDoAutor: string | null): Promise<{ texto: string; autoria: Autoria } | null> {
  const versao = versaoDe(corpo);
  if (versao === null) return null;
  const lugar = contextoDaMensagem(conversa, autor);
  const aberto = await decifrar(chave, corpo, lugar);
  if (aberto === null) return null;
  return abrirTexto(aberto, identidadeDoAutor, lugar, versao);
}

/** A chave da conversa precisa de versão nova? (nenhuma, a atual não serve para alguém, ou passou uma semana). */
export const ROTACAO_DIAS = 7;
export function precisaDeVersaoNova(versao: number, atualOk: boolean, versaoEm: string | null, agora = Date.now()): boolean {
  if (versao < 1 || !atualOk) return true;
  return versaoEm !== null && agora - Date.parse(versaoEm) > ROTACAO_DIAS * 86_400_000;
}

/**
 * Confiar na primeira vez, avisar quando mudar. `conhecida`: a identidade que este aparelho já guardou da pessoa. "nova": guarde;
 * "igual": segue; "mudou": a pessoa trocou de aparelho (ou alguém tenta se passar por ela): avisa e não entrega chave até confirmar.
 */
export function compararIdentidade(conhecida: string | null | undefined, atual: string): "nova" | "igual" | "mudou" {
  if (!conhecida) return "nova";
  return conhecida === atual ? "igual" : "mudou";
}
