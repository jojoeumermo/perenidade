// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As aulas ao vivo da Escola de Formação (PLANO-ESCOLA.md, F3; migração supabase/migracoes/20261108-escola-aovivo.sql).
// A aula da Escola é a mesma interno.aulas_ao_vivo do site, com publico = 'escola': o banco só a entrega a militante
// (aula_ao_vivo_ver devolve nada para os outros, o bate-papo vem vazio e recusa quem escreve). O id do vídeo no YouTube
// (não listado) só chega a quem o banco deixa ver; nada daqui fica gravado no aparelho.
//
// "caderno_aula" liga a aula ao vivo a uma aula de caderno: "<caderno>/<pedaço do endereço>", o mesmo pedaço de
// /escola/formacao/[caderno]/[aula] (lib/escola/contratos.ts, pedacoDaAula). A gravação aparece nessa aula
// (components/escola/aula/GravacaoDaAula.tsx, pela função escola_gravacoes).
//
// Prévia SÓ em desenvolvimento (como lib/escola/acesso.ts): com ?previa=militante, as funções daqui leem os exemplos de
// components/escola/aovivo/previa.ts, por import dinâmico (em produção o bloco some do pacote).
// Sem os atalhos "@/" de propósito: os testes importam este arquivo direto no Node.

import { BackendError, hasBackend, rpc } from "../backend";
import { emPrevia, lerDaEscola } from "./acesso";
import { type AulaAoVivoDaEscola, type CadernoDaEscola, cadernoPorSlug, lessonIdDoPedaco, pedacoDaAula } from "./contratos";

/** A aula da Escola como aula_ao_vivo_ver a devolve (interno.aula_json, com publico 'escola'). Nomes: só codinomes. */
export interface AulaDaEscolaNaSala {
  id: string;
  titulo: string;
  descricao: string;
  inicio: string;
  duracao: number;
  status: "agendada" | "ao_vivo" | "encerrada" | "cancelada";
  iniciada_em: string | null;
  encerrada_em: string | null;
  youtube: string | null;
  publico: "escola" | "site";
  caderno_aula: string | null;
  /** O id só vem para quem conduz; o nome é o codinome da Alumia (vazio se a pessoa não confirmou um). */
  educador: { id: string | null; nome: string };
  co_educadores: { id: string | null; nome: string }[];
  inscritos: number;
  inscrito: boolean;
  conduzo: boolean;
  mensagens: number | null;
}

/** Uma fala do bate-papo da Escola (interno.escola_chat_json): sem o id de quem escreveu, só "minha". */
export interface FalaDaEscola {
  id: string;
  minha: boolean;
  /** O codinome de quem escreveu; vazio nas falas do sistema. */
  nome: string;
  corpo: string;
  tipo: "fala" | "pergunta" | "sistema";
  oculta: boolean;
  /** Ficou em dúvida nas regras do banco: espera quem conduz (só quem escreveu e quem conduz veem). */
  esperando: boolean;
  criado_em: string;
}

// ───────────────────────────── Contas puras ─────────────────────────────

/** O id de um vídeo do YouTube, ou nulo (nada que não sejam os 11 caracteres de sempre chega ao tocador). */
export const idDoVideo = (x: string | null | undefined): string | null => (x && /^[A-Za-z0-9_-]{11}$/.test(x) ? x : null);

/** O "caderno_aula" de uma aula de caderno: "<caderno>/<pedaço do endereço>". */
export const cadernoAulaDe = (caderno: CadernoDaEscola, lessonId: string) => `${caderno.slug}/${pedacoDaAula(caderno, lessonId)}`;

/** Lê um "caderno_aula": o caderno (um dos 11), o pedaço do endereço e o lessonId; nulo se não for de um caderno. */
export function lerCadernoAula(valor: string | null | undefined): { caderno: CadernoDaEscola; pedaco: string; lessonId: string } | null {
  const achado = /^([a-z0-9-]{2,80})\/([a-z0-9-]{2,120})$/.exec(valor ?? "");
  if (!achado) return null;
  const caderno = cadernoPorSlug(achado[1]);
  return caderno ? { caderno, pedaco: achado[2], lessonId: lessonIdDoPedaco(caderno, achado[2]) } : null;
}

// ───────────────────────────── O banco (com a prévia de desenvolvimento) ─────────────────────────────

// O "process.env.NODE_ENV" na própria linha deixa o import morto no pacote de produção (o minificador o tira).
const previa = async () => (process.env.NODE_ENV === "development" && emPrevia() ? import("../../components/escola/aovivo/previa") : null);

export type Lido<T> = { ok: true; dados: T } | { ok: false; motivo: string };
const motivoDe = (erro: unknown) => (erro instanceof BackendError ? erro.code : "falha");

/** A aula para a sala. "nao_encontrado": não existe, foi cancelada ou não é para quem chama (o banco não diz qual). */
export async function lerAulaDaEscola(id: string): Promise<Lido<AulaDaEscolaNaSala>> {
  const p = await previa();
  if (p) return { ok: true, dados: p.aulaDeExemplo(id) };
  if (!hasBackend) return { ok: false, motivo: "sem_servico" };
  try {
    const aula = await rpc<AulaDaEscolaNaSala | null>("aula_ao_vivo_ver", { p_id: id });
    // Uma aula do site aberta pelo endereço da Escola: a sala da Escola não a mostra (ela tem a página dela).
    return aula && aula.publico === "escola" ? { ok: true, dados: aula } : { ok: false, motivo: "nao_encontrado" };
  } catch (erro) {
    return { ok: false, motivo: motivoDe(erro) };
  }
}

/** As falas (todas, ou só as que chegaram depois de "depois"). */
export async function lerFalas(aula: string, depois: string | null): Promise<FalaDaEscola[]> {
  const p = await previa();
  if (p) return p.falasDeExemplo(depois);
  return rpc<FalaDaEscola[]>("aula_chat_listar", { p_aula: aula, p_depois: depois });
}

export async function enviarFala(aula: string, corpo: string, tipo: "fala" | "pergunta"): Promise<FalaDaEscola> {
  const p = await previa();
  if (p) return p.falarNoExemplo(corpo, tipo);
  return rpc<FalaDaEscola>("aula_chat_enviar", { p_aula: aula, p_corpo: corpo, p_tipo: tipo });
}

/** Esconder (true) ou mostrar/liberar (false) uma fala. */
export async function moderarFala(id: string, ocultar: boolean): Promise<void> {
  const p = await previa();
  if (p) return p.moderarNoExemplo(id, ocultar);
  await rpc("aula_chat_moderar", { p_id: id, p_ocultar: ocultar });
}

export async function avisarQuandoComecar(aula: string, ligar: boolean): Promise<{ inscrito: boolean; inscritos: number }> {
  const p = await previa();
  if (p) return { inscrito: ligar, inscritos: 12 + (ligar ? 1 : 0) };
  return rpc("aula_ao_vivo_inscrever", { p_id: aula, p_inscrever: ligar });
}

/** As gravações ligadas a uma aula de caderno ("caderno/aula") ou ao caderno inteiro. Nunca lança. */
export async function lerGravacoes(cadernoAula: string): Promise<Lido<AulaAoVivoDaEscola[]>> {
  const p = await previa();
  if (p) return { ok: true, dados: p.gravacoesDeExemplo(cadernoAula) };
  const lido = await lerDaEscola("escola_gravacoes", { p_caderno: cadernoAula });
  return lido.ok ? { ok: true, dados: lido.dados ?? [] } : { ok: false, motivo: lido.motivo };
}

/** Quem está no painel pode marcar aula "só para a Escola"? (militante ou coordenação: o banco confere de novo ao salvar.) */
export async function podeMarcarNaEscola(): Promise<boolean> {
  if (process.env.NODE_ENV === "development" && emPrevia()) return true;
  const lido = await lerDaEscola("escola_eu");
  return lido.ok && lido.dados.militante === true;
}
