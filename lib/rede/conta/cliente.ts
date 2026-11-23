// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do grupo "conta, identidade e convivência" (Prompt 4, Parte H; supabase/migracoes/20261127-p4-conta.sql). Tudo vai
// direto ao banco com a sessão da pessoa: o banco confere o interruptor, a conta, a comunidade e a mediação em cada chamada. Nenhuma
// resposta traz lista de pessoas nem número abaixo de 3. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde
// (./duble.ts; nada vai a lugar nenhum). Sem "@/" de propósito.
import { chamar, type Chamar } from "../cliente";
import { dubleDaConta } from "./duble";
import type { Atendimento, Nivel } from "./regras";

export const PREVIA_DA_CONTA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export type QuemPode = "todos" | "seguindo" | "ninguem";
export interface Prefs {
  mencao_revisar: boolean;
  mencao_quem: QuemPode;
  marcar_quem: QuemPode;
  marcar_aprovar: boolean;
  atendimento: Atendimento | null;
  ausencia: string;
  nivel: Nivel | null;
  /** Quantas menções esperam a revisão (só ela vê). */
  pendentes: number;
}
export type Sugestao = "sair_rapido" | "print" | "trancar" | "fediverso";
export interface PrefsDoNivel extends Prefs {
  sugestoes: Sugestao[];
}
export interface MencaoNaFila {
  post: string;
  codinome: string;
  handle: string | null;
  trecho: string;
  quando: string;
}
export interface ComunidadeMinha {
  slug: string;
  nome: string;
  modero: boolean;
  regras: boolean;
  boas_vindas: boolean;
  pedidos: boolean;
}
export interface Escudo {
  travado_ate: string | null;
  modero: boolean;
  ligado?: boolean;
  contas?: number;
  conta_dias?: number;
  minutos?: number;
  horas?: number;
}
export interface PerguntaDoQuiz {
  numero?: number;
  pergunta: string;
  opcoes: string[];
  /** Só para quem modera. */
  certa?: number;
}
export interface Quiz {
  modero: boolean;
  aceitei: boolean;
  perguntas: PerguntaDoQuiz[];
}
export type RespostaDoQuiz = { ok: true; lidas_em?: string } | { ok: false; erradas: number };
export interface PassoDoGuia {
  titulo: string;
  texto: string;
  link: string;
}
export interface Guia {
  passos: PassoDoGuia[];
  posso_editar: boolean;
}
export interface Cuidado {
  sala: boolean;
  texto: string;
  modero: boolean;
}
export interface SalaDeCuidado {
  slug: string;
  nome: string;
}
export type SituacaoDaMediacao = "convite" | "aberta" | "acordo" | "sem_acordo" | "recusada";
export interface Mediacao {
  id: string;
  comunidade: { slug: string; nome: string };
  situacao: SituacaoDaMediacao;
  acordo: string;
  criado_em: string;
  encerrada_em: string | null;
  sou: "mediadora" | "parte";
  mediadora: string;
  partes: { codinome: string; eu: boolean; aceite: "pendente" | "aceitou" | "recusou"; acordo_ok: boolean }[];
  falas: { id: number; codinome: string; eu: boolean; mediadora: boolean; texto: string; quando: string }[];
}
export interface AtendimentoDe {
  tem_horario: boolean;
  fora: boolean;
  mensagem: string;
  horario: Atendimento | null;
}
export interface Mudanca {
  federada: boolean;
  handle: string | null;
  alvo: string | null;
  situacao: "conferir" | "enviada" | null;
  enviada_em: string | null;
  /** Quantas seguidoras de fora (nulo abaixo de 3). */
  seguidoras: number | null;
}

export function criarClienteDaConta(c: Chamar) {
  return {
    prefs: () => c<Prefs>("rede_p4_ct_prefs"),
    revisarMencoes: (sim: boolean) => c<Prefs>("rede_p4_ct_mencao_revisar", { p_sim: sim }),
    mencoes: () => c<{ itens: MencaoNaFila[] }>("rede_p4_ct_mencoes"),
    decidirMencao: (post: string, aprovar: boolean) => c<{ ok: true }>("rede_p4_ct_mencao_decidir", { p_post: post, p_aprovar: aprovar }),
    nivel: (nivel: Nivel) => c<PrefsDoNivel>("rede_p4_ct_nivel", { p_nivel: nivel }),
    minhas: () => c<{ comunidades: ComunidadeMinha[] }>("rede_p4_ct_minhas"),
    escudo: (slug: string) => c<Escudo>("rede_p4_ct_escudo", { p_slug: slug }),
    salvarEscudo: (slug: string, p: Partial<Pick<Escudo, "ligado" | "contas" | "conta_dias" | "minutos" | "horas">> & { destravar?: boolean }) => c<Escudo>("rede_p4_ct_escudo_salvar", { p_slug: slug, p }),
    quiz: (slug: string) => c<Quiz>("rede_p4_ct_quiz", { p_slug: slug }),
    salvarQuiz: (slug: string, p: PerguntaDoQuiz[]) => c<Quiz>("rede_p4_ct_quiz_salvar", { p_slug: slug, p }),
    responderQuiz: (slug: string, respostas: number[]) => c<RespostaDoQuiz>("rede_p4_ct_quiz_responder", { p_slug: slug, p_respostas: respostas }),
    guia: (slug: string) => c<Guia>("rede_p4_ct_guia", { p_slug: slug }),
    salvarGuia: (slug: string, p: PassoDoGuia[]) => c<Guia>("rede_p4_ct_guia_salvar", { p_slug: slug, p }),
    cuidado: (slug: string) => c<Cuidado>("rede_p4_ct_cuidado", { p_slug: slug }),
    salas: () => c<{ salas: SalaDeCuidado[] }>("rede_p4_ct_cuidados"),
    marcarCuidado: (slug: string, sim: boolean, texto: string) => c<Cuidado>("rede_p4_ct_cuidado_marcar", { p_slug: slug, p_sim: sim, p_texto: texto }),
    encaminhar: (slug: string, handle: string) => c<{ ok: true }>("rede_p4_ct_cuidado_encaminhar", { p_slug: slug, p_handle: handle }),
    mediacoes: () => c<{ itens: Mediacao[] }>("rede_p4_ct_mediacoes"),
    abrirMediacao: (slug: string, a: string, b: string) => c<Mediacao>("rede_p4_ct_mediacao_abrir", { p_slug: slug, p_handle_a: a, p_handle_b: b }),
    responderMediacao: (id: string, aceitar: boolean) => c<Mediacao>("rede_p4_ct_mediacao_responder", { p_id: id, p_aceitar: aceitar }),
    falar: (id: string, texto: string) => c<Mediacao>("rede_p4_ct_mediacao_falar", { p_id: id, p_texto: texto }),
    proporAcordo: (id: string, acordo: string) => c<Mediacao>("rede_p4_ct_mediacao_propor", { p_id: id, p_acordo: acordo }),
    aceitarAcordo: (id: string, sim: boolean) => c<Mediacao>("rede_p4_ct_mediacao_acordo", { p_id: id, p_sim: sim }),
    encerrarMediacao: (id: string) => c<Mediacao>("rede_p4_ct_mediacao_encerrar", { p_id: id }),
    salvarAtendimento: (a: { dias: number[]; de: string; ate: string } | null, ausencia: string) => c<Prefs>("rede_p4_ct_atendimento_salvar", { p_atendimento: a, p_ausencia: ausencia }),
    atendimentoDe: (handle: string) => c<AtendimentoDe | null>("rede_p4_ct_atendimento_de", { p_handle: handle }),
    mudanca: () => c<Mudanca>("rede_p4_ct_mudanca"),
    pedirMudanca: (alvo: string) => c<Mudanca>("rede_p4_ct_mudanca_pedir", { p_alvo: alvo }),
  };
}

export type ClienteDaConta = ReturnType<typeof criarClienteDaConta>;

export const conta = criarClienteDaConta(PREVIA_DA_CONTA ? dubleDaConta() : chamar);
