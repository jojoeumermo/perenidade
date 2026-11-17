// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as funções da frente 13B devolvem (supabase/migracoes/20261119-alumia-o13-mapa.sql): o mapa já agregado por cidade e o
// "Pergunte a…" ao vivo. Números só a partir de 3; nenhuma lista de pessoas. Sem os atalhos "@/" de propósito.

/** Uma organização com selo que pôs um núcleo no mapa (organização não é pessoa: o nome é público). */
export interface OrgDoMapa {
  handle: string;
  nome: string;
}

/** Um lugar do mapa (rede_mapa): a cidade na forma da chave, a UF quando se sabe, e o que há nela. */
export interface LugarDoMapa {
  nome: string;
  uf: string | null;
  /** Como alguém escreveu a cidade (para o lugar que o desenho não acha). */
  escrito: string;
  /** Quantos chamados (ato e mutirão), só a partir de 3; abaixo, nulo, e `chamados_ha` diz se há. */
  chamados: number | null;
  chamados_ha: boolean;
  /** Quantos eventos (assembleia, roda, aula, outro), só a partir de 3. */
  eventos: number | null;
  eventos_ha: boolean;
  /** Núcleo nunca tem número: só se há e de quais organizações. */
  nucleos_ha: boolean;
  orgs: OrgDoMapa[];
}

export interface Mapa {
  /** A janela dos chamados e eventos: de agora até daqui a `dias`. */
  dias: number;
  lugares: LugarDoMapa[];
}

// ───── Ao vivo ─────

export type MomentoDaSessao = "antes" | "ao_vivo" | "encerrada";
export type SituacaoDaSessao = "convite" | "marcada" | "recusada" | "cancelada";

export interface SessaoAoVivo {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  situacao: SituacaoDaSessao;
  momento: MomentoDaSessao;
  /** A pessoa que responde (só aparece para quem não cuida depois que ela aceitou). */
  convidada: { handle: string; nome: string };
  /** De quem é a caixa: a própria pessoa ou uma comunidade. */
  de: { tipo: "pessoa"; handle: string; nome: string } | { tipo: "comunidade"; slug: string; nome: string };
  /** Quantas perguntas, só a partir de 3. */
  perguntas: number | null;
  cuida: boolean;
  sou_convidada: boolean;
}

export type SituacaoDaPergunta = "fila" | "respondida" | "passada" | "retirada";
export type MotivoDaRetirada = "ofensa" | "dado_pessoal" | "fora_do_tema" | "repetida";
export const MOTIVOS_DA_RETIRADA: readonly MotivoDaRetirada[] = ["ofensa", "dado_pessoal", "fora_do_tema", "repetida"];

export interface PerguntaAoVivo {
  id: string;
  situacao: SituacaoDaPergunta;
  /** Nulo na retirada (a tela mostra só que foi retirada e o motivo). */
  texto: string | null;
  resposta: string | null;
  respondida_em: string | null;
  criado_em: string;
  motivo: MotivoDaRetirada | null;
  /** O codinome de quem perguntou, só se a pessoa quis aparecer. */
  quem: string | null;
  minha: boolean;
}

export interface SessaoComPerguntas extends SessaoAoVivo {
  /** A pergunta da vez: a primeira da fila (a convidada só responde ou passa essa). */
  vez: string | null;
  pode_perguntar: boolean;
  lista: PerguntaAoVivo[];
}

export interface AgendaAoVivo {
  ao_vivo: SessaoAoVivo[];
  proximas: SessaoAoVivo[];
  convites: SessaoAoVivo[];
}

export interface SessoesDaCaixa {
  cuida: boolean;
  sessoes: SessaoAoVivo[];
}

/** O pedido de marcar uma sessão (rede_ama_marcar). */
export interface PedidoDeSessao {
  titulo: string;
  /** ISO. */
  inicio: string;
  minutos: number;
  /** O @ de quem vai responder (só na sessão de comunidade). */
  convidada?: string;
}

/** Os limites da tela, iguais aos do banco (o teste confere). */
export const LIMITES_DO_AO_VIVO = {
  tituloMin: 3,
  titulo: 120,
  perguntaMin: 5,
  pergunta: 500,
  resposta: 2000,
  minutosMin: 15,
  minutosMax: 180,
  porCaixa: 3,
  esperandoPorPessoa: 3,
  porSessao: 300,
  diasAdiante: 60,
} as const;

/** As durações que a tela oferece (minutos). */
export const DURACOES = [30, 60, 90, 120, 180] as const;
