// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat privado da Alumia, cifrado de ponta a ponta sobre a mesma base das conversas da equipe (lib/sigilo.ts): chave de
// aparelho ECDH P-256 (privada não exportável), identidade ECDSA P-256 que certifica a chave do aparelho, e chave AES-GCM-256 por
// versão da conversa, embrulhada (ECDH + HKDF-SHA-256 + AES-GCM) para a chave de cada participante. O servidor
// (supabase/migracoes/20261106-t19-rede-chat-privado.sql e 20261110-chat-blocos.sql) só guarda a parte pública, os embrulhos e o
// cifrado. Documento: docs/rede/CHAT-PRIVADO.md.
//
// As mensagens saem no formato "c3" (lib/rede/chat/c3.ts): tamanho fixo em blocos, identificador e contador dentro do cifrado,
// e SEM assinatura do autor. A identidade assina só a chave do aparelho (o certificado), nunca uma mensagem: quem recebe sabe
// que a mensagem veio de quem tem a chave da conversa (as duas pessoas, e mais ninguém), mas nenhuma das duas consegue provar a
// um terceiro quem escreveu. As mensagens antigas, "c2" (assinadas), continuam sendo lidas e conferidas até vencerem.
//
// Diferenças em relação às conversas da equipe, de propósito:
//   - Uma chave por conta (o aparelho em que a pessoa ativou o chat). A identidade NÃO é exportável e nunca sai do aparelho:
//     não há cópia de recuperação nem aprovação de outro aparelho. Trocar de aparelho = chave nova; o que foi escrito antes
//     só abre no aparelho antigo. Menos comodidade, menos coisa que possa vazar.
//   - Contextos próprios ("alumia-dm:..."): nada cifrado ou assinado aqui serve nas conversas da equipe, nem o contrário.
//
// Sem "@/" e sem navegador além do WebCrypto: roda no Node nos testes (scripts/testar-rede-chat.mjs).
import {
  abrirTexto, assinar, type Autoria, codigoDeSeguranca, decifrar, desembrulhar, embrulhar, FORMATO_PUBLICA, type Identidade, novaChave,
  novoAparelho, paraBase64, type ParDoAparelho, verificar,
} from "../sigilo";
import { abrirC3, cifrarC3, formatoDe, NADA_VISTO, versaoDoCorpo, type Visto } from "./chat/c3";

export type { Autoria, Identidade, ParDoAparelho, Visto };
export { codigoDeSeguranca, formatoDe };
/** A versão da chave com que um corpo foi cifrado (c2 ou c3). */
export const versaoDe = versaoDoCorpo;

/** Quanto texto cabe numa mensagem (caracteres na tela). O maior cifrado (bloco de 8192 bytes) fica abaixo do teto do banco (12000). */
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
/** Onde cada mensagem ANTIGA (c2) mora: a conversa e quem escreveu. As c3 usam contextoC3 (lib/rede/chat/c3.ts), que leva também a versão e o formato. */
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
 * consegue fazer este aparelho entregar a chave a uma chave falsa. `chavesConfiadas[usuario]`, quando há, é a chave do aparelho
 * que este aparelho conhece da pessoa: neste chat a identidade e a chave do aparelho nascem juntas, então chave nova com a
 * identidade de sempre nunca é legítima (é o que faria quem conseguiu, uma vez, fazer a identidade assinar a chave dele).
 */
export async function prepararNovaVersao(conversa: string, versao: number, eu: Eu, participantes: ChaveDeParticipante[], confiadas: Record<string, string>, chavesConfiadas: Record<string, string> = {}) {
  if (participantes.length !== 2) throw new Error("participantes");
  const chave = await novaChave();
  const embrulhos: { para: string; chave_versao: number; embrulho: string }[] = [];
  for (const p of participantes) {
    const identidade = confiadas[p.usuario];
    if (!identidade || identidade !== p.identidade) throw new Error("identidade_nao_confiada");
    if (chavesConfiadas[p.usuario] && chavesConfiadas[p.usuario] !== p.publica) throw new Error("chave_nao_confiada");
    if (!(await chaveCertificada(identidade, p.usuario, p.publica, p.certificado))) throw new Error("certificado_invalido");
    if (p.usuario === eu.usuario && p.publica !== eu.aparelho.publica) throw new Error("outro_aparelho");
    embrulhos.push({ para: p.usuario, chave_versao: p.versao, embrulho: await embrulhar(chave, eu.aparelho.privada, p.publica, contextoDoEmbrulhoDoChat(conversa, versao, p.usuario, p.versao)) });
  }
  return { chave, embrulhos };
}

/**
 * Abre um embrulho feito para mim. Só aceita se a chave de quem embrulhou foi certificada pela identidade CONFIADA dessa pessoa.
 * Devolve null em qualquer dúvida (embrulho de outra conversa, de outra versão, adulterado, de chave não certificada, ou feito
 * com uma chave de aparelho diferente da que este aparelho conhece da pessoa, quando conhece: `chavesConfiadas`).
 */
export async function abrirEmbrulho(conversa: string, eu: Eu, e: EmbrulhoRecebido, confiadas: Record<string, string>, chavesConfiadas: Record<string, string> = {}): Promise<CryptoKey | null> {
  const identidade = confiadas[e.de];
  if (chavesConfiadas[e.de] && chavesConfiadas[e.de] !== e.de_publica) return null;
  if (!identidade || !(await chaveCertificada(identidade, e.de, e.de_publica, e.de_certificado))) return null;
  return desembrulhar(e.embrulho, eu.aparelho.privada, e.de_publica, contextoDoEmbrulhoDoChat(conversa, e.versao, eu.usuario, e.chave_versao));
}

/** O texto cabe? (caracteres e bytes; vazio não vai). */
export function textoCabe(texto: string): boolean {
  const limpo = texto.trim();
  return limpo.length > 0 && [...limpo].length <= MAX_CARACTERES && new TextEncoder().encode(limpo).length <= MAX_BYTES;
}

/**
 * Cifra com a chave da conversa, no formato que o banco aceita para mensagem nova ("c3.<versão>..."): preenchida até um bloco
 * de tamanho fixo, com identificador sorteado e o `contador` de quem escreve nesta versão, e sem assinatura. `visto`: a última
 * mensagem da outra pessoa que este aparelho já tinha recebido (vai dentro do cifrado).
 */
export async function cifrarMensagem(chave: CryptoKey, versao: number, eu: Pick<Eu, "usuario">, conversa: string, texto: string, contador: number, visto: Visto = NADA_VISTO): Promise<string> {
  if (!textoCabe(texto)) throw new Error("texto_grande");
  return cifrarC3(chave, versao, conversa, eu.usuario, texto.trim(), contador, visto);
}

/** Uma mensagem aberta neste aparelho. */
export interface MensagemLida {
  texto: string;
  formato: "c2" | "c3";
  /** Só nas antigas (c2): a assinatura do autor confere? Nas c3 não há assinatura (null). */
  autoria: Autoria | null;
  /** Só nas c3: o identificador, o contador e o "até onde eu já tinha recebido" de dentro do cifrado. */
  id: string | null;
  contador: number | null;
  visto: Visto | null;
}

/**
 * Até quando este aparelho ainda abre mensagem no formato antigo ("c2"). O banco deixa de aceitar c2 novo quando a migração
 * 20261110-chat-blocos.sql é aplicada, e toda mensagem vence em no máximo 30 dias: depois desta data nenhuma c2 legítima existe
 * mais, e uma c2 que aparecer é mensagem velha regravada. Se a migração for aplicada DEPOIS de 20/11/2026, mude esta data para
 * o dia da migração mais 30 dias (docs/rede/CHAT-PRIVADO.md, passo a passo).
 */
export const C2_ABRE_ATE = Date.parse("2026-12-20T00:00:00Z");

/**
 * Abre uma mensagem. null = esta chave não abre (ou a mensagem foi adulterada, ou mudada de conversa, de autor ou de versão).
 * c3: quem garante que veio de um dos dois é a própria chave da conversa. c2 (antiga): confere também a assinatura do autor, e
 * só abre até C2_ABRE_ATE (o formato antigo não tem identificador nem contador: depois do prazo, é recusado).
 */
export async function abrirMensagem(chave: CryptoKey, corpo: string, conversa: string, autor: string, identidadeDoAutor: string | null, agora = Date.now()): Promise<MensagemLida | null> {
  const formato = formatoDe(corpo);
  if (formato === "c3") {
    const aberta = await abrirC3(chave, corpo, conversa, autor);
    return aberta ? { texto: aberta.texto, formato, autoria: null, id: aberta.id, contador: aberta.contador, visto: aberta.visto } : null;
  }
  const versao = versaoDoCorpo(corpo);
  if (formato !== "c2" || versao === null || agora > C2_ABRE_ATE) return null;
  const lugar = contextoDaMensagem(conversa, autor);
  const aberto = await decifrar(chave, corpo, lugar);
  if (aberto === null) return null;
  return { ...(await abrirTexto(aberto, identidadeDoAutor, lugar, versao)), formato, id: null, contador: null, visto: null };
}

/** A chave da conversa precisa de versão nova? (nenhuma, a atual não serve para alguém, ou passou uma semana). */
export const ROTACAO_DIAS = 7;
/** O banco recusa envio em versão mais velha que isto (um dia de folga sobre a rotação do aparelho). */
export const VERSAO_VELHA_DIAS = 8;
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
