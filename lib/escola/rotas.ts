// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As páginas da Escola Revolucionária Lúcia Maria (abaixo de /escola), quem é dono de cada uma na Etapa 4, quais entram
// na faixa de navegação da Escola e em que grupo cada uma aparece no mapa da entrada ("Tudo o que tem na Escola"). As
// provisórias mostram "Esta parte da Escola está sendo montada" até o pacote dono substituir.
// As rotas e as chaves ficam com os nomes de sempre (a do Assistente continua "acompanhante", em /escola/acompanhante):
// só o texto visível mudou.
// Sem os atalhos "@/" de propósito: `npm run testar:escola` confere que cada uma tem a sua página.

/** Os grupos do mapa da entrada, na ordem em que aparecem (textos em i18n/escola/base, "mapa.grupos"). */
export const GRUPOS_DA_ESCOLA = ["frente", "estudar", "vidaEscolar", "ajuda", "mundo", "organizacao", "escola"] as const;
export type GrupoDaEscola = (typeof GRUPOS_DA_ESCOLA)[number];

export interface RotaDaEscola {
  /** Chave do texto em i18n/escola/base (nav ou paginas). */
  chave: string;
  /** Caminho sem o idioma. */
  caminho: string;
  /** Pacote da Etapa 4 dono da página. */
  pacote: string;
  /** Entra na faixa de links da Escola (NavDaEscola)? */
  naFaixa?: boolean;
  /** Começa como página provisória do E4-01 (EmConstrucao)? */
  provisoria?: boolean;
  /** Grupo no mapa da entrada. Sem grupo (só a própria entrada), não aparece no mapa. */
  grupo?: GrupoDaEscola;
}

export const BASE_DA_ESCOLA = "/escola";

export const ROTAS_DA_ESCOLA: readonly RotaDaEscola[] = [
  { chave: "entrada", caminho: "/escola", pacote: "E4-01", naFaixa: true },
  { chave: "quemFoi", caminho: "/escola/quem-foi-lucia-maria", pacote: "E4-01", naFaixa: true, grupo: "escola" },
  // T15: a Frente Revolucionária Lúcia (o chamado de militantes e o manifesto). As duas são públicas: veja PUBLICAS_DA_ESCOLA.
  { chave: "militantes", caminho: "/escola/militantes", pacote: "T15", naFaixa: true, grupo: "frente" },
  { chave: "manifesto", caminho: "/escola/manifesto", pacote: "T15", naFaixa: true, grupo: "frente" },
  { chave: "cursos", caminho: "/escola/cursos", pacote: "E4-07", naFaixa: true, grupo: "estudar" },
  { chave: "matricula", caminho: "/escola/matricula", pacote: "E4-08", naFaixa: true, grupo: "vidaEscolar" },
  { chave: "calendario", caminho: "/escola/calendario", pacote: "E4-09", naFaixa: true, grupo: "escola" },
  { chave: "campus", caminho: "/escola/campus", pacote: "E4-09", naFaixa: true, grupo: "escola" },
  { chave: "turmas", caminho: "/escola/turmas", pacote: "E4-15", naFaixa: true, grupo: "estudar" },
  { chave: "acompanhante", caminho: "/escola/acompanhante", pacote: "E4-10", naFaixa: true, grupo: "ajuda" },
  { chave: "caderneta", caminho: "/escola/caderneta", pacote: "E4-14", naFaixa: true, grupo: "vidaEscolar" },
  { chave: "carteirinha", caminho: "/escola/carteirinha", pacote: "E4-08", grupo: "vidaEscolar" },
  { chave: "plano", caminho: "/escola/plano", pacote: "E4-08", grupo: "estudar" },
  { chave: "vozes", caminho: "/escola/vozes", pacote: "E4-11", grupo: "mundo" },
  { chave: "lutas", caminho: "/escola/lutas", pacote: "E4-11", grupo: "mundo" },
  { chave: "assembleia", caminho: "/escola/assembleia", pacote: "E4-12", grupo: "organizacao" },
  { chave: "ouvidoria", caminho: "/escola/ouvidoria", pacote: "E4-12", grupo: "organizacao" },
  { chave: "educador-do-mes", caminho: "/escola/educador-do-mes", pacote: "E4-12", grupo: "organizacao" },
  { chave: "provas", caminho: "/escola/provas", pacote: "E4-13", grupo: "estudar" },
  { chave: "saberes", caminho: "/escola/saberes", pacote: "E4-13", grupo: "estudar" },
  { chave: "formatura", caminho: "/escola/formatura", pacote: "E4-14", grupo: "vidaEscolar" },
  { chave: "vida", caminho: "/escola/vida", pacote: "E4-11", grupo: "mundo" },
  { chave: "agentes", caminho: "/escola/agentes", pacote: "E4-16", grupo: "ajuda" },
];

/**
 * As páginas da Escola que abrem SEM conta (a porta, components/escola/PortaDaEscola.tsx, deixa passar): o chamado de
 * voluntários militantes e o manifesto da Frente Revolucionária Lúcia (T15). O chamado precisa chegar a quem ainda
 * não é da casa, e a inscrição, como a do voluntariado, não pede conta. Caminhos sem o idioma.
 */
export const PUBLICAS_DA_ESCOLA: readonly string[] = ["/escola/militantes", "/escola/manifesto"];

/** O caminho (sem o idioma) abre sem conta? Vale também para a barra no fim. */
export const publicaDaEscola = (caminhoSemIdioma: string) => PUBLICAS_DA_ESCOLA.includes(caminhoSemIdioma.replace(/\/+$/, "") || "/");

/** As da faixa de navegação, na ordem. */
export const FAIXA_DA_ESCOLA = ROTAS_DA_ESCOLA.filter((r) => r.naFaixa);

/** O mapa da entrada: cada grupo com as suas páginas, na ordem da lista acima. Grupo vazio não aparece. */
export function mapaDaEscola(): { grupo: GrupoDaEscola; rotas: RotaDaEscola[] }[] {
  return GRUPOS_DA_ESCOLA.map((grupo) => ({ grupo, rotas: ROTAS_DA_ESCOLA.filter((r) => r.grupo === grupo) })).filter((g) => g.rotas.length > 0);
}

/** A rota de um caminho (sem idioma), ou null. */
export const rotaDe = (caminho: string) => ROTAS_DA_ESCOLA.find((r) => r.caminho === caminho) ?? null;

/** O link da faixa que está aberto num caminho (a entrada só vale exata; as outras valem para as páginas de baixo). */
export function abertaNaFaixa(caminhoSemIdioma: string): string | null {
  let achada: RotaDaEscola | null = null;
  for (const r of FAIXA_DA_ESCOLA) {
    const casa = r.caminho === BASE_DA_ESCOLA ? caminhoSemIdioma === r.caminho : caminhoSemIdioma === r.caminho || caminhoSemIdioma.startsWith(`${r.caminho}/`);
    if (casa && (!achada || r.caminho.length > achada.caminho.length)) achada = r;
  }
  return achada?.chave ?? null;
}
