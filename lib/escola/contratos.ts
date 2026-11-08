// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O CONTRATO da Escola de Formação (docs/plano-2026-11/PLANO-ESCOLA.md, seções 4 e 5): os nomes das funções do banco
// de TODAS as frentes, o que cada uma recebe e devolve, os endereços das telas e a ordem dos 11 cadernos. A F1 escreve
// este arquivo para as outras frentes programarem contra ele em paralelo. Quem implementa uma função no banco segue o
// formato daqui; quem precisar mudar um formato muda aqui E na migração, no mesmo commit.
//
// Sem "use client" e sem nada do servidor: é só tipo e constante, serve aos dois lados e aos testes no Node.
// Nada secreto mora aqui (o arquivo vai para o navegador): só nomes de funções e formatos.
// Sem os atalhos "@/" de propósito (os testes importam este arquivo direto no Node).

// ───────────────────────────── Valores fechados ─────────────────────────────

export type Degrau = 1 | 2 | 3;
export const DEGRAUS: readonly Degrau[] = [1, 2, 3];

/** As 7 frentes de atuação (confirmadas em 07/11). Mesma lista do check de interno.escola_militancia.frente. */
export const FRENTES_DE_ATUACAO = ["estudantil", "bairros", "trabalho", "agitprop", "atos", "cultura", "solidariedade"] as const;
export type FrenteDeAtuacao = (typeof FRENTES_DE_ATUACAO)[number];

/** Quem vê as conquistas da Escola no perfil da Alumia (perfis.escola_publico). Padrão: ninguém. */
export const PUBLICOS_DAS_CONQUISTAS = ["ninguem", "militantes", "seguidores", "todos"] as const;
export type PublicoDasConquistas = (typeof PUBLICOS_DAS_CONQUISTAS)[number];

export const TIPOS_DE_CONQUISTA = ["carteirinha", "aula", "caderno", "degrau"] as const;
export type TipoDeConquista = (typeof TIPOS_DE_CONQUISTA)[number];

export const SITUACOES_DA_BANCA = ["marcada", "aprovada", "refazer"] as const;
export type SituacaoDaBanca = (typeof SITUACOES_DA_BANCA)[number];

/** Uma pessoa vista na Escola: SEMPRE pelo codinome da Alumia (nunca o nome civil). handle nulo = invisível ou sem @. */
export interface PessoaDaEscola {
  codinome: string | null;
  handle: string | null;
}

// ───────────────────────────── F1 · escola_eu ─────────────────────────────

/** public.escola_eu(): quem não é militante recebe só isto. "conta" diz se havia sessão (a porta oferece "Entrar" ou não). */
export interface EscolaEuFora {
  militante: false;
  conta: boolean;
}

export interface EscolaEuDentro {
  militante: true;
  conta: true;
  /** O codinome da Alumia, só quando confirmado (rede_codinome_ok). Nulo: a pessoa ainda não escolheu. */
  codinome: string | null;
  handle: string | null;
  degrau: Degrau;
  frente: FrenteDeAtuacao | null;
  nucleo: { id: string; nome: string } | null;
  acompanha: PessoaDaEscola | null;
  /** AAAA-MM-DD. Nulo para a coordenação que entra sem estar no departamento. */
  desde: string | null;
  publico: PublicoDasConquistas;
  /** Coordenação ou vice: vê o painel da Escola. */
  coordena: boolean;
}

export type EscolaEu = EscolaEuFora | EscolaEuDentro;

// ───────────────────────────── F3 · ao vivo ─────────────────────────────

/** Uma aula ao vivo da Escola (interno.aulas_ao_vivo com publico = 'escola'). O id do YouTube só vem para militante. */
export interface AulaAoVivoDaEscola {
  id: string;
  titulo: string;
  /** ISO 8601. */
  inicio: string;
  status: "marcada" | "ao_vivo" | "encerrada";
  /** "caderno/aula" (formato de aulas_ao_vivo.caderno_aula), ou nulo. */
  caderno_aula: string | null;
  youtube: string | null;
}

/** public.escola_aulas_hoje(): as de hoje, as dos próximos 7 dias (horário de Brasília) e as gravadas. */
export interface EscolaAulasHoje {
  hoje: AulaAoVivoDaEscola[];
  proximas: AulaAoVivoDaEscola[];
  gravadas: AulaAoVivoDaEscola[];
}

// ───────────────────────────── F4 · núcleo, recados, pergunta, banca, painel ─────────────────────────────

export interface ItemDaPauta {
  texto: string;
  /** "levar ao núcleo": item que veio da dúvida de um militante (sem dizer de quem). */
  levado?: boolean;
}

export interface TarefaDoEncontro {
  id: string;
  item: string;
  quem: PessoaDaEscola | null;
  /** A tarefa é minha ("Eu levo")? */
  minha: boolean;
  feito: boolean;
}

export interface EncontroDoNucleo {
  id: string;
  /** ISO 8601. */
  quando: string;
  pauta: ItemDaPauta[];
  tarefas: TarefaDoEncontro[];
}

/** public.escola_nucleo(): o núcleo de quem chama. nucleo nulo = ainda sem núcleo. */
export interface EscolaNucleo {
  nucleo: { id: string; nome: string } | null;
  proximo: EncontroDoNucleo | null;
  /** Presença das 4 últimas reuniões: SÓ números, do mais antigo ao mais novo. */
  presenca: { quando: string; presenca: number | null }[];
  /** Pode salvar a pauta (mediação do núcleo na Alumia ou coordenação). */
  medeia: boolean;
}

export interface EncontroParaSalvar {
  id?: string;
  nucleo: string;
  quando: string;
  pauta: ItemDaPauta[];
  presenca?: number | null;
  balanco?: string;
  tarefas?: { item: string; quem?: string | null; feito?: boolean }[];
}

/** public.escola_pergunta_da_semana(): nula quando a coordenação ainda não definiu. */
export interface PerguntaDaSemana {
  /** AAAA-MM-DD, a segunda-feira da semana. */
  semana: string;
  texto: string;
}

export interface RecadoDaFormacao {
  id: string;
  texto: string;
  /** AAAA-MM-DD. */
  ate: string;
  /** Nulo: recado para toda a Escola. */
  nucleo: string | null;
}

export interface BancaDePassagem {
  id: string;
  militante: PessoaDaEscola;
  degrau: Degrau;
  quando: string | null;
  situacao: SituacaoDaBanca;
  /** Só para o militante, quem acompanha e a coordenação. */
  balanco: string;
}

/** Linha do painel da coordenação (public.escola_militantes_listar). Sem nome civil e sem e-mail. */
export interface MilitanteNoPainel {
  usuario: string;
  codinome: string | null;
  degrau: Degrau;
  frente: FrenteDeAtuacao | null;
  nucleo: { id: string; nome: string } | null;
  acompanha: PessoaDaEscola | null;
  desde: string | null;
}

// ───────────────────────────── F5 · conquistas ─────────────────────────────

export interface ConquistaDaEscola {
  tipo: TipoDeConquista;
  alvo: string;
  verificada: boolean;
  em: string;
}

export interface MinhasConquistas {
  publico: PublicoDasConquistas;
  conquistas: ConquistaDaEscola[];
}

// ───────────────────────────── F6 · a Frente ─────────────────────────────

/** public.escola_frentes_somadas(): só contagem por frente, nunca nomes. */
export type FrentesSomadas = Partial<Record<FrenteDeAtuacao, number>>;

// ───────────────────────────── O mapa das funções ─────────────────────────────

type Ok = { ok: true };

/**
 * Cada função pública do banco da Escola: o nome, os argumentos (com os nomes exatos do SQL) e o que volta.
 * "frente" diz quem implementa (a migração de cada frente em supabase/migracoes/).
 */
export interface FuncoesDaEscola {
  // F1 · 2026-11-escola-formacao-base.sql
  escola_eu: { frente: "F1"; args: Record<string, never>; volta: EscolaEu };
  // F3 · 2026-11-escola-aovivo.sql
  escola_aulas_hoje: { frente: "F3"; args: Record<string, never>; volta: EscolaAulasHoje };
  escola_gravacoes: { frente: "F3"; args: { p_caderno: string }; volta: AulaAoVivoDaEscola[] };
  // F4 · 2026-11-escola-nucleo.sql
  escola_nucleo: { frente: "F4"; args: Record<string, never>; volta: EscolaNucleo };
  escola_encontro_salvar: { frente: "F4"; args: { p: EncontroParaSalvar }; volta: Ok & { id: string } };
  escola_tarefa_pegar: { frente: "F4"; args: { p_id: string; p_pegar: boolean }; volta: Ok };
  escola_levar_ao_nucleo: { frente: "F4"; args: { p_texto: string }; volta: Ok };
  escola_pergunta_da_semana: { frente: "F4"; args: Record<string, never>; volta: PerguntaDaSemana | null };
  escola_pergunta_definir: { frente: "F4"; args: { p: { semana: string; texto: string } }; volta: Ok };
  escola_recados: { frente: "F4"; args: Record<string, never>; volta: RecadoDaFormacao[] };
  escola_recado_salvar: { frente: "F4"; args: { p: { id?: string; texto: string; ate: string; nucleo?: string | null; apagar?: boolean } }; volta: Ok };
  escola_acompanhar: { frente: "F4"; args: { p_militante: string; p_acompanha: string | null }; volta: Ok };
  escola_banca_marcar: { frente: "F4"; args: { p: { militante: string; degrau: Degrau; quando?: string | null; nucleo?: string | null } }; volta: Ok & { id: string } };
  escola_banca_decidir: { frente: "F4"; args: { p_id: string; p_situacao: SituacaoDaBanca; p_balanco: string }; volta: Ok };
  escola_militantes_listar: { frente: "F4"; args: Record<string, never>; volta: MilitanteNoPainel[] };
  escola_militante_ajustar: { frente: "F4"; args: { p: { usuario: string; nucleo?: string | null; frente?: FrenteDeAtuacao | null; degrau?: Degrau } }; volta: Ok };
  // F5 · 2026-11-escola-conquistas.sql
  escola_conquista_declarar: { frente: "F5"; args: { p_tipo: "aula" | "caderno"; p_alvo: string; p_ligar: boolean }; volta: Ok };
  escola_publico_definir: { frente: "F5"; args: { p: PublicoDasConquistas }; volta: Ok };
  escola_conquistas_minhas: { frente: "F5"; args: Record<string, never>; volta: MinhasConquistas };
  // F6 · 2026-11-escola-frente.sql
  escola_frente_escolher: { frente: "F6"; args: { p_frente: FrenteDeAtuacao | null }; volta: Ok };
  escola_frentes_somadas: { frente: "F6"; args: Record<string, never>; volta: FrentesSomadas };
}

export type FuncaoDaEscola = keyof FuncoesDaEscola;

/** Os nomes, com a frente dona de cada um (o teste confere que batem com o tipo acima e com as migrações que existem). */
export const FUNCOES_DA_ESCOLA: { readonly [N in FuncaoDaEscola]: FuncoesDaEscola[N]["frente"] } = {
  escola_eu: "F1",
  escola_aulas_hoje: "F3",
  escola_gravacoes: "F3",
  escola_nucleo: "F4",
  escola_encontro_salvar: "F4",
  escola_tarefa_pegar: "F4",
  escola_levar_ao_nucleo: "F4",
  escola_pergunta_da_semana: "F4",
  escola_pergunta_definir: "F4",
  escola_recados: "F4",
  escola_recado_salvar: "F4",
  escola_acompanhar: "F4",
  escola_banca_marcar: "F4",
  escola_banca_decidir: "F4",
  escola_militantes_listar: "F4",
  escola_militante_ajustar: "F4",
  escola_conquista_declarar: "F5",
  escola_publico_definir: "F5",
  escola_conquistas_minhas: "F5",
  escola_frente_escolher: "F6",
  escola_frentes_somadas: "F6",
};

/** A migração de cada frente (supabase/migracoes/). A F2 não tem SQL. */
export const MIGRACOES_DA_ESCOLA = {
  F1: "2026-11-escola-formacao-base.sql",
  F3: "2026-11-escola-aovivo.sql",
  F4: "2026-11-escola-nucleo.sql",
  F5: "2026-11-escola-conquistas.sql",
  F6: "2026-11-escola-frente.sql",
} as const;

// ───────────────────────────── Endereços das telas (sem o idioma) ─────────────────────────────

export const TELAS_DA_ESCOLA = {
  hoje: "/escola",
  formacao: "/escola/formacao",
  nucleo: "/escola/nucleo",
  biblioteca: "/escola/biblioteca",
  percurso: "/escola/percurso",
  frente: "/escola/frente",
  duvida: "/escola/duvida",
  militantes: "/escola/militantes",
  manifesto: "/escola/manifesto",
} as const;

export const caminhoDoCaderno = (caderno: string) => `/escola/formacao/${caderno}`;
export const caminhoDaSalaAoVivo = (id: string) => `/escola/ao-vivo/${id}`;

/**
 * O pedaço da aula no endereço /escola/formacao/[caderno]/[aula]. A aula guarda o MESMO lessonId de /trilhas
 * ("trilha/aula", lib/ids.ts): quando a aula é da trilha do caderno, o pedaço é só o slug da aula; quando vem de outra
 * trilha (cadernos 01 e 11, montados com aulas de várias trilhas), é "trilha--aula".
 */
export function pedacoDaAula(caderno: CadernoDaEscola, lessonId: string): string {
  const [trilha, aula] = lessonId.split("/");
  return caderno.fonte.tipo === "trilha" && caderno.fonte.trilha === trilha ? aula : `${trilha}--${aula}`;
}

/** O lessonId de volta, a partir do pedaço do endereço. */
export function lessonIdDoPedaco(caderno: CadernoDaEscola, pedaco: string): string {
  if (pedaco.includes("--")) return pedaco.replace("--", "/");
  return caderno.fonte.tipo === "trilha" ? `${caderno.fonte.trilha}/${pedaco}` : pedaco;
}

export const caminhoDaAula = (caderno: CadernoDaEscola, lessonId: string) => `${caminhoDoCaderno(caderno.slug)}/${pedacoDaAula(caderno, lessonId)}`;

/** O código curto da aula no quadro: F-0304 = caderno 03, aula 04 (contada a partir de 1). */
export const codigoDaAula = (numero: number, posicao: number) => `F-${String(numero).padStart(2, "0")}${String(posicao + 1).padStart(2, "0")}`;

// ───────────────────────────── Os 11 cadernos (ordem e fonte) ─────────────────────────────

export type FonteDoCaderno = { tipo: "despertar" } | { tipo: "trilha"; trilha: string } | { tipo: "curso"; curso: string };

export interface CadernoDaEscola {
  /** 1 a 11. */
  numero: number;
  degrau: Degrau;
  /** O pedaço do endereço /escola/formacao/[caderno]. */
  slug: string;
  fonte: FonteDoCaderno;
}

/**
 * A ordem e a fonte dos 11 cadernos (tabela 1.6 do plano). O resto (patrono, lado A/B, tarefa, roda, minutos) mora em
 * lib/escola/cadernos.ts, da F2, que lê esta lista. O nome de cada caderno, nos 6 idiomas, está em
 * i18n/escola/formacao-base ("cadernos").
 */
export const CADERNOS_DA_ESCOLA: readonly CadernoDaEscola[] = [
  { numero: 1, degrau: 1, slug: "consciencia-de-classe", fonte: { tipo: "despertar" } },
  { numero: 2, degrau: 1, slug: "primeiros-passos-na-militancia", fonte: { tipo: "trilha", trilha: "primeiros-passos-na-militancia" } },
  { numero: 3, degrau: 2, slug: "conversar-com-quem-pensa-diferente", fonte: { tipo: "trilha", trilha: "conversar-com-quem-pensa-diferente" } },
  { numero: 4, degrau: 2, slug: "organizacao-de-base", fonte: { tipo: "trilha", trilha: "organizacao-de-base" } },
  { numero: 5, degrau: 2, slug: "organizacao-sindical-de-base", fonte: { tipo: "trilha", trilha: "organizacao-sindical-de-base" } },
  { numero: 6, degrau: 2, slug: "comunicacao-popular", fonte: { tipo: "trilha", trilha: "comunicacao-popular" } },
  { numero: 7, degrau: 2, slug: "seguranca-e-cuidado-na-militancia", fonte: { tipo: "trilha", trilha: "seguranca-e-cuidado-na-militancia" } },
  { numero: 8, degrau: 3, slug: "analise-de-conjuntura", fonte: { tipo: "trilha", trilha: "analise-de-conjuntura" } },
  { numero: 9, degrau: 3, slug: "formar-formadores", fonte: { tipo: "trilha", trilha: "formar-formadores" } },
  { numero: 10, degrau: 3, slug: "guardar-a-memoria", fonte: { tipo: "trilha", trilha: "guardar-a-memoria" } },
  { numero: 11, degrau: 3, slug: "ano-de-formacao-politica", fonte: { tipo: "curso", curso: "ano-de-formacao-politica" } },
];

export const cadernoPorSlug = (slug: string) => CADERNOS_DA_ESCOLA.find((c) => c.slug === slug) ?? null;
