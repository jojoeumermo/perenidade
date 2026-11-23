// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do grupo "organização e ação coletiva" (Prompt 4; supabase/migracoes/20261127-p4-organizacao.sql). Tudo vai direto ao
// banco com a sessão da pessoa: o banco confere o interruptor, a conta, a organização, a comunidade e a mediação em cada chamada.
// Nenhuma resposta traz quem assumiu, votou, apoiou, contribuiu, propôs ou avaliou, nem número de pessoas abaixo de 3. Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde (./duble.ts; nada vai a lugar nenhum). Sem "@/" de propósito.
import { chamar, type Chamar } from "../cliente";
import { dubleDaOrganizacao } from "./duble";
import type { ApoioDaRota, AtoDaRota, Coordenada, LugarDoTermometro, ReuniaoRecorrente, RotaDoAto } from "./regras";

export const PREVIA_DA_ORGANIZACAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface OrgMinha {
  handle: string;
  nome: string;
  gerencio: boolean;
}
export interface ComunidadeMinha {
  slug: string;
  nome: string;
  modero: boolean;
}
export interface Minhas {
  orgs: OrgMinha[];
  comunidades: ComunidadeMinha[];
}

// ── 52/122. Quadro ──
export type Coluna = "a_fazer" | "fazendo" | "feito";
export const COLUNAS: readonly Coluna[] = ["a_fazer", "fazendo", "feito"];
export interface Cartao {
  id: string;
  titulo: string;
  notas: string;
  coluna: Coluna;
  prazo: string | null;
  ato: { id: string; titulo: string; inicio: string } | null;
  funcao: { id: string; nome: string } | null;
  eu: boolean;
  tem_quem: boolean;
  /** Quantas pessoas assumiram: nulo abaixo de 3. */
  assumidas: number | null;
  recorrencia?: "semanal" | "quinzenal" | "mensal" | null;
  rodizio?: { id: string; nome: string }[];
}
export interface Quadro {
  gerencio: boolean;
  cartoes: Cartao[];
  funcoes: { id: string; nome: string }[];
  atos: { id: string; titulo: string; inicio: string }[];
}
export interface NovoCartao {
  org: string;
  titulo: string;
  notas?: string;
  prazo?: string;
  ato?: string;
  funcao?: string;
  recorrencia?: string;
  rodizio?: string[];
}

// ── 53. Enquete de horário ──
export interface EnqueteDeHorario {
  id: string;
  titulo: string;
  opcoes: string[];
  fecha_em: string;
  fechada: boolean;
  votei: boolean;
  posso_fechar: boolean;
  /** Só depois de fechada: cada total e o de quem votou, nulos abaixo de 3; o melhor horário (1..n) só com 3 ou mais marcas. */
  resultado: { votantes: number | null; totais: (number | null)[]; melhor: number | null } | null;
}
export interface Horarios {
  posso_criar: boolean;
  enquetes: EnqueteDeHorario[];
}

// ── 54. Reuniões recorrentes ──
export interface Reunioes {
  posso_criar: boolean;
  reunioes: ReuniaoRecorrente[];
}

// ── 55/63. Mural da comunidade ──
export type TipoDoMural = "ofereco" | "preciso" | "vaga" | "bico";
export interface PedidoDoMural {
  id: string;
  tipo: TipoDoMural;
  categoria: string;
  titulo: string;
  texto: string;
  link?: string | null;
  criado_em: string;
  expira_em: string;
  meu: boolean;
  /** O codinome e o @ de quem pôs (para combinar por mensagem). */
  autor: { codinome: string; handle: string } | null;
}
export interface Mural {
  posso_por: boolean;
  modero: boolean;
  itens: PedidoDoMural[];
}

// ── 56. Banco de tempo ──
export interface TrocaDeHoras {
  id: string;
  servico: string;
  minutos: number;
  estado: "pendente" | "confirmada" | "recusada";
  dia: string;
  papel: "dei" | "recebi";
  pode_responder: boolean;
  /** A outra pessoa da troca (que a própria pessoa já conhece). */
  outra: { codinome: string; handle: string } | null;
}
export interface BancoDeTempo {
  /** Minutos dados menos recebidos, só os confirmados. Só a própria pessoa vê. */
  saldo_min: number;
  trocas: TrocaDeHoras[];
}

// ── 57. Inventário ──
export interface CoisaDoInventario {
  id: string;
  nome: string;
  notas: string;
  quantidade: number;
  emprestadas: number;
  disponiveis: number;
}
export interface Inventario {
  gerencio: boolean;
  coisas: CoisaDoInventario[];
}

// ── 58. Pontos de apoio ──
export interface PontoDeApoio {
  id: string;
  tipo: string;
  nome: string;
  endereco: string;
  cidade: string;
  horario: string;
  aprovado: boolean;
}
export interface PontosDeApoio {
  posso_propor: boolean;
  modero: boolean;
  pontos: PontoDeApoio[];
  /** Só para a mediação; nulo para os outros. */
  pendentes: PontoDeApoio[] | null;
}

// ── 59. Rota do ato ──
export interface AtoParaRota {
  id: string;
  titulo: string;
  inicio: string;
  cidade: string;
  /** A pessoa chama o ato (pode desenhar a rota). */
  chamo: boolean;
  tem_rota: boolean;
}
export interface RotaVista {
  ato: AtoDaRota & { cancelado: boolean };
  posso_desenhar: boolean;
  rota: RotaDoAto | null;
}

// ── 60. Consenso por posições ──
export type Posicao = "concordo" | "ressalva" | "abstenho" | "bloqueio";
export interface Consenso {
  id: string;
  proposta: string;
  fecha_em: string;
  fechado: boolean;
  votei: boolean;
  posso_fechar: boolean;
  /** Só depois de fechado: os totais (nulos abaixo de 3) e, com 3 ou mais pessoas, se houve bloqueio e se houve consenso. */
  resultado: { votantes: number | null; totais: Record<Posicao, number | null>; houve_bloqueio: boolean | null; consenso: boolean | null } | null;
}
export interface Consensos {
  posso_criar: boolean;
  consensos: Consenso[];
}

// ── 61. Orçamento participativo ──
export interface PropostaDoOrcamento {
  id: string;
  titulo: string;
  descricao: string;
  centavos: number;
  /** Só na votação, e só a partir de 3. */
  apoios: number | null;
}
export interface Orcamento {
  id: string;
  titulo: string;
  centavos: number;
  propostas_ate: string;
  apoio_ate: string;
  fase: "propostas" | "apoio" | "votacao";
  caixa: { id: string; nome: string } | null;
  consulta: { id: string; pergunta: string; prazo: string } | null;
  apoiei: boolean;
  apoiadores: number | null;
  posso_conduzir: boolean;
  propostas: PropostaDoOrcamento[];
}
export interface Orcamentos {
  posso_criar: boolean;
  caixas: { id: string; nome: string }[];
  /** Só para quem conduz a mesa: as consultas da organização, para ligar ao orçamento. */
  consultas: { id: string; pergunta: string; prazo: string }[] | null;
  orcamentos: Orcamento[];
}

// ── 62. Meta coletiva ──
export interface Meta {
  id: string;
  titulo: string;
  unidade: string;
  alvo: number;
  prazo: string | null;
  encerrada: boolean;
  /** Quantas pessoas somaram: nulo abaixo de 3. */
  pessoas: number | null;
  somei: boolean;
  /** A soma e se bateu a meta: nulas com menos de 3 pessoas. */
  soma: number | null;
  atingida: boolean | null;
  posso_encerrar: boolean;
}
export interface Metas {
  posso_criar: boolean;
  metas: Meta[];
}

// ── 64. Termômetro do território ──
export interface Lugares {
  municipio: string;
  uf: string;
  lugares: LugarDoTermometro[];
}

// ── 65. Apoio direto ──
export interface ApoioDireto {
  pix: string | null;
  link: string | null;
  texto: string;
  /** Só na leitura pelo @: é o da própria pessoa. */
  meu?: boolean;
}

/** O cliente sobre uma forma de chamar (os testes e a prévia trocam por outra). */
export function criarClienteDaOrganizacao(c: Chamar) {
  return {
    /** As organizações de que a pessoa é de dentro e as comunidades dela (só as dela). */
    minhas: () => c<Minhas>("rede_p4_or_minhas"),
    quadro: (org: string) => c<Quadro>("rede_p4_or_quadro", { p_org: org }),
    criarCartao: (p: NovoCartao) => c<Cartao>("rede_p4_or_cartao_criar", { p }),
    moverCartao: (id: string, coluna: Coluna) => c<Cartao>("rede_p4_or_cartao_mover", { p_id: id, p_coluna: coluna }),
    assumirCartao: (id: string, sim: boolean) => c<Cartao>("rede_p4_or_cartao_assumir", { p_id: id, p_sim: sim }),
    apagarCartao: (id: string) => c<{ ok: true }>("rede_p4_or_cartao_apagar", { p_id: id }),
    horarios: (org: string) => c<Horarios>("rede_p4_or_horarios", { p_org: org }),
    criarHorario: (p: { org: string; titulo: string; opcoes: string[]; fecha_em: string }) => c<EnqueteDeHorario>("rede_p4_or_horario_criar", { p }),
    votarHorario: (id: string, opcoes: number[]) => c<EnqueteDeHorario>("rede_p4_or_horario_votar", { p_id: id, p_opcoes: opcoes }),
    fecharHorario: (id: string) => c<EnqueteDeHorario>("rede_p4_or_horario_fechar", { p_id: id }),
    reunioes: (org: string) => c<Reunioes>("rede_p4_or_reunioes", { p_org: org }),
    criarReuniao: (p: Record<string, string | number>) => c<ReuniaoRecorrente>("rede_p4_or_reuniao_criar", { p }),
    apagarReuniao: (id: string) => c<{ ok: true }>("rede_p4_or_reuniao_apagar", { p_id: id }),
    mural: (slug: string, tipo?: TipoDoMural) => c<Mural>("rede_p4_or_mural", { p_slug: slug, p_tipo: tipo ?? null }),
    porNoMural: (p: { comunidade: string; tipo: TipoDoMural; categoria?: string; titulo: string; texto?: string; link?: string }) => c<PedidoDoMural>("rede_p4_or_mural_por", { p }),
    tirarDoMural: (id: string) => c<{ ok: true }>("rede_p4_or_mural_tirar", { p_id: id }),
    bancoDeTempo: (slug: string) => c<BancoDeTempo>("rede_p4_or_banco_de_tempo", { p_slug: slug }),
    registrarHoras: (p: { comunidade: string; de: string; minutos: number; servico: string }) => c<TrocaDeHoras>("rede_p4_or_hora_registrar", { p }),
    responderHoras: (id: string, sim: boolean) => c<TrocaDeHoras>("rede_p4_or_hora_responder", { p_id: id, p_sim: sim }),
    apagarHoras: (id: string) => c<{ ok: true }>("rede_p4_or_hora_apagar", { p_id: id }),
    inventario: (org: string) => c<Inventario>("rede_p4_or_inventario", { p_org: org }),
    criarCoisa: (p: { org: string; nome: string; notas?: string; quantidade: number }) => c<CoisaDoInventario>("rede_p4_or_coisa_criar", { p }),
    emprestarCoisa: (id: string, pegar: boolean) => c<CoisaDoInventario>("rede_p4_or_coisa_emprestar", { p_id: id, p_pegar: pegar }),
    apagarCoisa: (id: string) => c<{ ok: true }>("rede_p4_or_coisa_apagar", { p_id: id }),
    pontos: (slug: string) => c<PontosDeApoio>("rede_p4_or_pontos", { p_slug: slug }),
    proporPonto: (p: { comunidade: string; tipo: string; nome: string; endereco: string; cidade: string; horario?: string; publico: boolean }) => c<PontoDeApoio>("rede_p4_or_ponto_propor", { p }),
    decidirPonto: (id: string, aprovar: boolean) => c<PontoDeApoio | { ok: true }>("rede_p4_or_ponto_decidir", { p_id: id, p_aprovar: aprovar }),
    rotaAtos: () => c<AtoParaRota[]>("rede_p4_or_rota_atos"),
    rota: (ato: string) => c<RotaVista>("rede_p4_or_rota", { p_ato: ato }),
    salvarRota: (ato: string, p: { pontos: Coordenada[]; apoios: ApoioDaRota[] }) => c<RotaVista>("rede_p4_or_rota_salvar", { p_ato: ato, p }),
    apagarRota: (ato: string) => c<{ ok: true }>("rede_p4_or_rota_apagar", { p_ato: ato }),
    consensos: (org: string) => c<Consensos>("rede_p4_or_consensos", { p_org: org }),
    criarConsenso: (p: { org: string; proposta: string; fecha_em: string }) => c<Consenso>("rede_p4_or_consenso_criar", { p }),
    posicionar: (id: string, posicao: Posicao) => c<Consenso>("rede_p4_or_consenso_posicao", { p_id: id, p_posicao: posicao }),
    fecharConsenso: (id: string) => c<Consenso>("rede_p4_or_consenso_fechar", { p_id: id }),
    orcamentos: (org: string) => c<Orcamentos>("rede_p4_or_orcamentos", { p_org: org }),
    criarOrcamento: (p: { org: string; titulo: string; caixa?: string; centavos: number; propostas_ate: string; apoio_ate: string }) => c<Orcamento>("rede_p4_or_orcamento_criar", { p }),
    proporNoOrcamento: (id: string, p: { titulo: string; descricao?: string; centavos: number }) => c<Orcamento>("rede_p4_or_orcamento_propor", { p_id: id, p }),
    apoiarNoOrcamento: (id: string, propostas: string[]) => c<Orcamento>("rede_p4_or_orcamento_apoiar", { p_id: id, p_propostas: propostas }),
    ligarConsulta: (id: string, consulta: string | null) => c<Orcamento>("rede_p4_or_orcamento_consulta", { p_id: id, p_consulta: consulta }),
    metas: (org: string) => c<Metas>("rede_p4_or_metas", { p_org: org }),
    criarMeta: (p: { org: string; titulo: string; unidade: string; alvo: number; prazo?: string }) => c<Meta>("rede_p4_or_meta_criar", { p }),
    somarNaMeta: (id: string, quanto: number) => c<Meta>("rede_p4_or_meta_somar", { p_id: id, p_quanto: quanto }),
    encerrarMeta: (id: string) => c<Meta>("rede_p4_or_meta_encerrar", { p_id: id }),
    lugares: (municipio: string, uf: string) => c<Lugares>("rede_p4_or_lugares", { p_municipio: municipio, p_uf: uf }),
    criarLugar: (p: { tipo: string; nome: string; municipio: string; uf: string }) => c<LugarDoTermometro>("rede_p4_or_lugar_criar", { p }),
    avaliarLugar: (id: string, nota: number, problemas: string[]) => c<LugarDoTermometro>("rede_p4_or_lugar_avaliar", { p_id: id, p_nota: nota, p_problemas: problemas }),
    apoioMeu: () => c<ApoioDireto | null>("rede_p4_or_apoio_meu"),
    salvarApoio: (p: { pix?: string; link?: string; texto?: string }) => c<ApoioDireto | null>("rede_p4_or_apoio_salvar", { p }),
    apoioDe: (handle: string) => c<ApoioDireto | null>("rede_p4_or_apoio_de", { p_handle: handle }),
    pedirChecagem: (post: string, motivo: string) => c<{ ok: true; ja_na_fila: boolean }>("rede_p4_or_checagem_pedir", { p_post: post, p_motivo: motivo }),
  };
}

export type ClienteDaOrganizacao = ReturnType<typeof criarClienteDaOrganizacao>;

export const organizacao = criarClienteDaOrganizacao(PREVIA_DA_ORGANIZACAO ? dubleDaOrganizacao() : chamar);
