// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O núcleo da Escola de Formação (PLANO-ESCOLA.md, F4; migração supabase/migracoes/20261108-escola-nucleo.sql): os tipos
// que a tela do núcleo e o painel da coordenação recebem, as contas puras (pauta em ver-julgar-agir, presença, semana da
// pergunta geradora) e o jeito único de chamar o banco daqui (chamarDoNucleo), que nunca lança.
//
// Nada daqui fica gravado no aparelho: pauta, tarefas, banca e recados moram só no banco e na memória da aba.
// Prévia SÓ em desenvolvimento (?previa=militante, lib/escola/acesso.ts): os dados de exemplo vêm por import() dinâmico,
// dentro do bloco de desenvolvimento. O build ainda gera o pedaço (chunk) da prévia, mas em produção ele nunca é
// carregado (emPrevia() é sempre false) e só tem dados inventados. O painel da coordenação não usa a prévia: lê e grava
// sempre no banco (chamarNoBanco), para não mostrar dado do banco e fingir que salvou.
// Sem os atalhos "@/" de propósito (o teste importa este arquivo direto no Node).

import { BackendError, rpc } from "../backend";
import { emPrevia } from "./acesso";
import type { BancaDePassagem, Degrau, EncontroDoNucleo, EscolaNucleo, FuncoesDaEscola, MilitanteNoPainel, PessoaDaEscola, TarefaDoEncontro } from "./contratos";

// ───────────────────────────── O que volta do banco (além do contrato) ─────────────────────────────

/** A tarefa como o militante vê: "repete" = ele fez esta mesma tarefa na roda anterior (rodízio: deixe para outra pessoa). */
export interface TarefaNoNucleo extends TarefaDoEncontro {
  repete: boolean;
}

export interface EncontroNoNucleo extends EncontroDoNucleo {
  tarefas: TarefaNoNucleo[];
}

/** public.escola_nucleo(), com o que a tela do núcleo usa além do contrato: a roda que passou (presença e balanço). */
export interface NucleoCompleto extends EscolaNucleo {
  proximo: EncontroNoNucleo | null;
  anterior: { id: string; quando: string; presenca: number | null; balanco: string } | null;
}

/** public.escola_bancas_listar(): as minhas, as de quem acompanho e (coordenação) todas. */
export interface BancaListada extends BancaDePassagem {
  /** O id de quem passa pela banca (só chega a quem já pode ver a banca: a pessoa, quem acompanha, a coordenação). */
  usuario: string;
  minha: boolean;
  /** Quem chama pode registrar o que a banca decidiu (acompanha a pessoa ou é da coordenação). */
  decido: boolean;
}

/** public.escola_militantes_listar() (só a coordenação): a linha do contrato e o id de quem acompanha (para a escolha). */
export interface MilitanteDoPainel extends MilitanteNoPainel {
  acompanha_id: string | null;
}

/** public.escola_acompanho(): quem eu acompanho (para quem é do Degrau 3). */
export interface Acompanhado extends PessoaDaEscola {
  usuario: string;
  degrau: Degrau;
  banca_marcada: boolean;
}

/** public.escola_painel_resumo(): o resto do painel da coordenação. */
export interface ResumoDoPainel {
  nucleos: { id: string; nome: string; cidade: string; militantes: number }[];
  recados: { id: string; texto: string; ate: string; nucleo: string | null }[];
  perguntas: { semana: string; texto: string }[];
  /** A segunda-feira desta semana, em Brasília. */
  semana: string;
}

/** As funções da F4 que vão além do contrato (lib/escola/contratos.ts): só a tela do núcleo e o painel as chamam. */
export const FUNCOES_DO_NUCLEO = ["escola_bancas_listar", "escola_acompanho", "escola_painel_resumo"] as const;

interface FuncoesExtras {
  escola_bancas_listar: { args: Record<string, never>; volta: BancaListada[] };
  escola_acompanho: { args: Record<string, never>; volta: Acompanhado[] };
  escola_painel_resumo: { args: Record<string, never>; volta: ResumoDoPainel };
}

type DoContrato = Pick<
  FuncoesDaEscola,
  | "escola_encontro_salvar"
  | "escola_tarefa_pegar"
  | "escola_levar_ao_nucleo"
  | "escola_pergunta_da_semana"
  | "escola_pergunta_definir"
  | "escola_recados"
  | "escola_recado_salvar"
  | "escola_acompanhar"
  | "escola_banca_marcar"
  | "escola_banca_decidir"
  | "escola_militante_ajustar"
>;

/** Tudo o que esta frente chama. escola_nucleo volta completo (com "anterior" e "repete"). */
export type FuncoesDoNucleo = { [N in keyof DoContrato]: { args: DoContrato[N]["args"]; volta: DoContrato[N]["volta"] } } & FuncoesExtras & {
  escola_nucleo: { args: Record<string, never>; volta: NucleoCompleto };
  escola_militantes_listar: { args: Record<string, never>; volta: MilitanteDoPainel[] };
};
export type FuncaoDoNucleo = keyof FuncoesDoNucleo;

// ───────────────────────────── Erros ─────────────────────────────

/** Os motivos que a tela sabe dizer (chaves de "erros" em i18n/escola/nucleo). */
export const MOTIVOS = [
  "rodizio",
  "ja_tem_quem",
  "sem_nucleo",
  "sem_encontro",
  "pauta_cheia",
  "sem_permissao",
  "banca_ja_marcada",
  "banca_ja_decidida",
  "acompanhante_degrau_3",
  "nao_encontrado",
  "muitas_tentativas",
  "ausente",
  "sem_servico",
  "invalido",
  "falha",
] as const;
export type MotivoDoErro = (typeof MOTIVOS)[number];

/** O código do banco vira um motivo conhecido: "invalido:texto" → "invalido"; o que não se conhece → "falha". */
export function motivoDoErro(codigo: string): MotivoDoErro {
  if (codigo === "banco_desatualizado") return "ausente";
  if (codigo === "entre_primeiro") return "sem_permissao";
  if (codigo === "muitos_pedidos") return "muitas_tentativas";
  const [tipo] = codigo.split(":");
  return (MOTIVOS as readonly string[]).includes(tipo) ? (tipo as MotivoDoErro) : "falha";
}

export type Resposta<T> = { ok: true; dados: T } | { ok: false; motivo: MotivoDoErro };

/** Chama uma função da F4. Nunca lança: devolve os dados ou o motivo. Na prévia de desenvolvimento, os exemplos. */
export async function chamarDoNucleo<N extends FuncaoDoNucleo>(nome: N, args?: FuncoesDoNucleo[N]["args"]): Promise<Resposta<FuncoesDoNucleo[N]["volta"]>> {
  if (emPrevia()) {
    const { exemploDoNucleo } = await import("../../components/escola/nucleo/previa");
    return exemploDoNucleo(nome, (args ?? {}) as Record<string, unknown>) as Resposta<FuncoesDoNucleo[N]["volta"]>;
  }
  return chamarNoBanco(nome, args);
}

/** Como chamarDoNucleo, mas sempre no banco, sem prévia (o painel da coordenação lê pelo banco e grava pelo banco). */
export async function chamarNoBanco<N extends FuncaoDoNucleo>(nome: N, args?: FuncoesDoNucleo[N]["args"]): Promise<Resposta<FuncoesDoNucleo[N]["volta"]>> {
  try {
    const dados = await rpc<FuncoesDoNucleo[N]["volta"]>(nome, (args ?? {}) as Record<string, unknown>);
    return { ok: true, dados };
  } catch (erro) {
    return { ok: false, motivo: motivoDoErro(erro instanceof BackendError ? erro.code : "falha") };
  }
}

// ───────────────────────────── Contas puras ─────────────────────────────

/**
 * A roda em ver-julgar-agir (método da educação popular dos grupos de base; PLANO-ESCOLA.md, seção 3), aberta e fechada
 * pela mística. As chaves são as do kit em i18n/escola/nucleo ("kit.pautaModelo" tem o texto de cada uma, na mesma ordem).
 */
export const PAUTA_VER_JULGAR_AGIR = ["misticaAbertura", "ver", "julgar", "agir", "misticaFechamento"] as const;

export const MAX_ITENS_DA_PAUTA = 12;
export const MAX_TAREFAS = 12;

const igual = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * Monta a pauta em roda: os itens do modelo (na ordem) e, depois, o que já estava na pauta e não é do modelo (os itens
 * levados pelos militantes, por exemplo). Sem repetir, sem vazio, até 12.
 */
export function pautaEmRoda(modelo: readonly string[], ...atuais: string[]): { texto: string }[] {
  const saida: string[] = [];
  for (const texto of [...modelo, ...atuais]) {
    const limpo = texto.replace(/\s+/g, " ").trim();
    if (limpo && !saida.some((x) => igual(x, limpo))) saida.push(limpo);
  }
  return saida.slice(0, MAX_ITENS_DA_PAUTA).map((texto) => ({ texto }));
}

/** "9, 11, 8, 12": a presença das rodas, só os números (– quando a roda não registrou). */
export function linhaDaPresenca(lista: { quando: string; presenca: number | null }[]): string {
  return lista.map((x) => (x.presenca === null || x.presenca === undefined ? "–" : String(x.presenca))).join(", ");
}

const FUSO = "America/Sao_Paulo";
const diaEmBrasilia = (agora: Date) => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: FUSO }).format(agora);

/** A segunda-feira (AAAA-MM-DD) da semana de uma data, contada no horário de Brasília. */
export function semanaDe(agora = new Date()): string {
  const [a, m, d] = diaEmBrasilia(agora).split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const desdeSegunda = (dia.getUTCDay() + 6) % 7;
  dia.setUTCDate(dia.getUTCDate() - desdeSegunda);
  return dia.toISOString().slice(0, 10);
}

/** A segunda-feira da semana que vem. */
export function proximaSegunda(agora = new Date()): string {
  const d = new Date(`${semanaDe(agora)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-16T19:00" (campo datetime-local) no horário de Brasília → ISO com o fuso (-03:00; o Brasil não tem horário de verão desde 2019). */
export function deCampoParaIso(valor: string): string | null {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor) ? `${valor}:00-03:00` : null;
}

/** ISO → "2026-11-16T19:00" no horário de Brasília (para o campo datetime-local). */
export function deIsoParaCampo(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: FUSO }).formatToParts(new Date(iso));
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? "00";
  return `${p("year")}-${p("month")}-${p("day")}T${p("hour")}:${p("minute")}`;
}
