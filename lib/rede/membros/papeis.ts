// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem é quem dentro de um grupo, sem o servidor saber. Três peças, todas assinadas com Ed25519 (@noble/curves) pela identidade da
// conta, sobre textos canônicos com rótulo (lib/rede/membros/bytes.ts):
//
// 1. Apresentação: "a folha <cliente> deste grupo sou eu (identidade), e esta é a minha chave X-Wing neste grupo". Vai como
//    mensagem de aplicação do MLS, que a biblioteca já autentica pela folha; o aparelho confere que quem mandou (senderClientId) é a
//    folha da apresentação. A credencial do MLS não é a conta (Uuid sorteado por grupo, domínio alumia.invalid).
// 2. Lista de papéis: quem é da mediação, numa cadeia que começa em quem criou o grupo. Cada versão nova é assinada por alguém da
//    mediação da versão anterior e leva o resumo dela. Ninguém de fora da cadeia promove ninguém.
// 3. Autorização de commit: quem faz um commit assina "commit <resumo> na época <n>, para <ação>". Antes de passar o commit para a
//    biblioteca, cada aparelho confere a assinatura e o papel; depois, confere que a mudança de membros foi a que a autorização
//    disse. Commit sem autorização é ignorado; commit autorizado que muda outra coisa deixa o grupo marcado como suspeito.
//
// O servidor não fiscaliza nada disso: ele não sabe quem é quem. Os aparelhos fiscalizam.
import { ed25519 } from "@noble/curves/ed25519.js";
import { canonico, deB64, iguais, juntar, paraB64, resumo, texto, u32, u64 } from "./bytes";
import { ROTULOS } from "./rotulos";
import type { Identidade } from "./tipos";

function confereAssinatura(assinatura: Uint8Array, mensagem: Uint8Array, publica: Uint8Array): boolean {
  try {
    return publica.length === 32 && assinatura.length === 64 && ed25519.verify(assinatura, mensagem, publica);
  } catch {
    return false;
  }
}

// ── Apresentação ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export interface Apresentacao {
  identidade: string; // b64url, 32 bytes
  cliente: string; // b64url dos bytes do ClientId do MLS
  xwing: string; // b64url da chave pública X-Wing desta folha (para receber a chave de entrada se virar mediação)
  assinatura: string;
}

function textoDaApresentacao(grupo: Uint8Array, a: Omit<Apresentacao, "assinatura">): Uint8Array {
  return canonico(ROTULOS.folha, grupo, deB64(a.identidade), deB64(a.cliente), deB64(a.xwing));
}

export async function apresentar(identidade: Identidade, grupo: Uint8Array, cliente: Uint8Array, xwing: Uint8Array): Promise<Apresentacao> {
  const a = { identidade: paraB64(identidade.publica), cliente: paraB64(cliente), xwing: paraB64(xwing) };
  return { ...a, assinatura: paraB64(await identidade.assinar(textoDaApresentacao(grupo, a))) };
}

export function apresentacaoValida(grupo: Uint8Array, a: Apresentacao): boolean {
  try {
    return confereAssinatura(deB64(a.assinatura), textoDaApresentacao(grupo, a), deB64(a.identidade));
  } catch {
    return false;
  }
}

// ── Lista de papéis ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface ListaDePapeis {
  versao: number;
  mediacao: string[]; // identidades (b64url), em ordem
  anterior: string; // resumo da versão anterior (b64url; 32 zeros na primeira)
  por: string; // identidade de quem assinou
  assinatura: string;
}

function textoDosPapeis(grupo: Uint8Array, l: Omit<ListaDePapeis, "assinatura">): Uint8Array {
  const mediacao = [...l.mediacao].sort();
  return canonico(ROTULOS.papeis, grupo, u32(l.versao), juntar(...mediacao.map((m) => deB64(m))), deB64(l.anterior), deB64(l.por));
}

export function resumoDosPapeis(grupo: Uint8Array, l: ListaDePapeis): Uint8Array {
  return resumo(textoDosPapeis(grupo, l), deB64(l.assinatura));
}

/** A primeira lista: quem cria o grupo é a mediação. */
export async function primeirosPapeis(identidade: Identidade, grupo: Uint8Array): Promise<ListaDePapeis> {
  const eu = paraB64(identidade.publica);
  const l = { versao: 1, mediacao: [eu], anterior: paraB64(new Uint8Array(32)), por: eu };
  return { ...l, assinatura: paraB64(await identidade.assinar(textoDosPapeis(grupo, l))) };
}

/** A versão seguinte, assinada por quem é da mediação na atual. */
export async function novosPapeis(identidade: Identidade, grupo: Uint8Array, atual: ListaDePapeis, mediacao: string[]): Promise<ListaDePapeis> {
  const eu = paraB64(identidade.publica);
  if (!atual.mediacao.includes(eu)) throw new Error("sem_papel");
  if (mediacao.length === 0 || new Set(mediacao).size !== mediacao.length) throw new Error("papeis_invalidos");
  const l = { versao: atual.versao + 1, mediacao: [...mediacao], anterior: paraB64(resumoDosPapeis(grupo, atual)), por: eu };
  return { ...l, assinatura: paraB64(await identidade.assinar(textoDosPapeis(grupo, l))) };
}

function assinaturaDosPapeisConfere(grupo: Uint8Array, l: ListaDePapeis): boolean {
  try {
    return (
      Number.isInteger(l.versao) &&
      l.versao >= 1 &&
      Array.isArray(l.mediacao) &&
      l.mediacao.length > 0 &&
      new Set(l.mediacao).size === l.mediacao.length &&
      confereAssinatura(deB64(l.assinatura), textoDosPapeis(grupo, l), deB64(l.por))
    );
  } catch {
    return false;
  }
}

/** Aceita a próxima versão só se for a seguinte, ligada à atual, e assinada por alguém da mediação atual. */
export function aceitarPapeis(grupo: Uint8Array, atual: ListaDePapeis, nova: ListaDePapeis): boolean {
  return (
    nova.versao === atual.versao + 1 &&
    atual.mediacao.includes(nova.por) &&
    iguais(deB64(nova.anterior), resumoDosPapeis(grupo, atual)) &&
    assinaturaDosPapeisConfere(grupo, nova)
  );
}

/**
 * Confere a cadeia inteira, da primeira versão à última, e devolve a última (ou `null`). A primeira tem de ser assinada por
 * alguém que ela mesma põe na mediação (quem criou) e, quando o aparelho já sabe quem criou, por essa pessoa.
 */
export function conferirCadeia(grupo: Uint8Array, cadeia: ListaDePapeis[], criador?: string): ListaDePapeis | null {
  if (!Array.isArray(cadeia) || cadeia.length === 0) return null;
  const [primeira, ...resto] = cadeia;
  if (
    primeira.versao !== 1 ||
    !iguais(deB64(primeira.anterior), new Uint8Array(32)) ||
    !primeira.mediacao.includes(primeira.por) ||
    (criador !== undefined && primeira.por !== criador) ||
    !assinaturaDosPapeisConfere(grupo, primeira)
  )
    return null;
  let atual = primeira;
  for (const nova of resto) {
    if (!aceitarPapeis(grupo, atual, nova)) return null;
    atual = nova;
  }
  return atual;
}

// ── Autorização de commit ─────────────────────────────────────────────────────────────────────────────────────────────────

export type AcaoDoCommit = "atualizar" | "adicionar" | "remover";

export interface Autorizacao {
  epoca: string; // época de onde o commit sai (texto decimal)
  acao: AcaoDoCommit;
  commit: string; // resumo SHA-256 do commit (b64url)
  por: string;
  assinatura: string;
}

function textoDaAutorizacao(grupo: Uint8Array, a: Omit<Autorizacao, "assinatura">): Uint8Array {
  return canonico(ROTULOS.commit, grupo, u64(BigInt(a.epoca)), texto(a.acao), deB64(a.commit), deB64(a.por));
}

export async function autorizar(identidade: Identidade, grupo: Uint8Array, epoca: bigint, acao: AcaoDoCommit, commit: Uint8Array): Promise<Autorizacao> {
  const a = { epoca: epoca.toString(), acao, commit: paraB64(resumo(commit)), por: paraB64(identidade.publica) };
  return { ...a, assinatura: paraB64(await identidade.assinar(textoDaAutorizacao(grupo, a))) };
}

export type JuizoDoCommit = { ok: true } | { ok: false; motivo: "assinatura" | "epoca" | "resumo" | "sem_papel" | "desconhecido" };

/**
 * Antes de passar o commit à biblioteca: a assinatura confere, é desta época e deste commit, quem assinou é membro conhecido
 * (tem apresentação) e, para pôr ou tirar gente, é da mediação.
 */
export function julgarCommit(
  grupo: Uint8Array,
  epoca: bigint,
  commit: Uint8Array,
  a: Autorizacao,
  papeis: ListaDePapeis,
  membrosConhecidos: ReadonlySet<string>,
): JuizoDoCommit {
  try {
    if (!confereAssinatura(deB64(a.assinatura), textoDaAutorizacao(grupo, a), deB64(a.por))) return { ok: false, motivo: "assinatura" };
    if (a.epoca !== epoca.toString()) return { ok: false, motivo: "epoca" };
    if (!iguais(deB64(a.commit), resumo(commit))) return { ok: false, motivo: "resumo" };
  } catch {
    return { ok: false, motivo: "assinatura" };
  }
  if (!membrosConhecidos.has(a.por) && !papeis.mediacao.includes(a.por)) return { ok: false, motivo: "desconhecido" };
  if (a.acao !== "atualizar" && !papeis.mediacao.includes(a.por)) return { ok: false, motivo: "sem_papel" };
  if (a.acao !== "atualizar" && a.acao !== "adicionar" && a.acao !== "remover") return { ok: false, motivo: "assinatura" };
  return { ok: true };
}

/** Depois do commit: a mudança de membros (clientes antes e depois) tem de ser a que a autorização disse. */
export function mudancaConfere(acao: AcaoDoCommit, antes: ReadonlySet<string>, depois: ReadonlySet<string>): boolean {
  const entraram = [...depois].filter((c) => !antes.has(c));
  const sairam = [...antes].filter((c) => !depois.has(c));
  if (acao === "atualizar") return entraram.length === 0 && sairam.length === 0;
  if (acao === "adicionar") return entraram.length > 0 && sairam.length === 0;
  return sairam.length > 0 && entraram.length === 0;
}

// ── Pacote de boas-vindas ─────────────────────────────────────────────────────────────────────────────────────────────────

export interface BoasVindas {
  grupo: string;
  welcome: string;
  cadeia: ListaDePapeis[];
  apresentacoes: Apresentacao[];
  chaveDeEntrada?: string; // só quando quem entra vem para a mediação (a privada X-Wing da caixa de entrada)
  por: string;
  assinatura: string;
}

function textoDasBoasVindas(b: Omit<BoasVindas, "assinatura">): Uint8Array {
  const cadeia = texto(JSON.stringify(b.cadeia));
  const apres = texto(JSON.stringify(b.apresentacoes));
  return canonico(ROTULOS.boasVindas, deB64(b.grupo), deB64(b.welcome), resumo(cadeia), resumo(apres), deB64(b.chaveDeEntrada ?? ""), deB64(b.por));
}

export async function assinarBoasVindas(identidade: Identidade, b: Omit<BoasVindas, "assinatura" | "por">): Promise<BoasVindas> {
  const sem = { ...b, por: paraB64(identidade.publica) };
  return { ...sem, assinatura: paraB64(await identidade.assinar(textoDasBoasVindas(sem))) };
}

/** Confere o pacote: assinatura de quem mandou, cadeia de papéis inteira e quem mandou é da mediação da última versão. */
export function conferirBoasVindas(b: BoasVindas, criador?: string): ListaDePapeis | null {
  try {
    if (!confereAssinatura(deB64(b.assinatura), textoDasBoasVindas(b), deB64(b.por))) return null;
    const grupo = deB64(b.grupo);
    const papeis = conferirCadeia(grupo, b.cadeia, criador);
    if (!papeis || !papeis.mediacao.includes(b.por)) return null;
    if (!b.apresentacoes.every((a) => apresentacaoValida(grupo, a))) return null;
    return papeis;
  } catch {
    return null;
  }
}
