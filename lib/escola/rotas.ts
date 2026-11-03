// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As páginas da Escola Lúcia Maria (abaixo de /escola), quem é dono de cada uma na Etapa 4 e quais entram na faixa de
// navegação da Escola. As provisórias mostram "Esta parte da Escola está sendo montada" até o pacote dono substituir.
// Sem os atalhos "@/" de propósito: `npm run testar:escola` confere que cada uma tem a sua página.

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
}

export const BASE_DA_ESCOLA = "/escola";

export const ROTAS_DA_ESCOLA: readonly RotaDaEscola[] = [
  { chave: "entrada", caminho: "/escola", pacote: "E4-01", naFaixa: true },
  { chave: "quemFoi", caminho: "/escola/quem-foi-lucia-maria", pacote: "E4-01", naFaixa: true },
  { chave: "cursos", caminho: "/escola/cursos", pacote: "E4-07", naFaixa: true },
  { chave: "matricula", caminho: "/escola/matricula", pacote: "E4-08", naFaixa: true },
  { chave: "calendario", caminho: "/escola/calendario", pacote: "E4-09", naFaixa: true },
  { chave: "campus", caminho: "/escola/campus", pacote: "E4-09", naFaixa: true },
  { chave: "turmas", caminho: "/escola/turmas", pacote: "E4-15", naFaixa: true },
  { chave: "acompanhante", caminho: "/escola/acompanhante", pacote: "E4-10", naFaixa: true },
  { chave: "caderneta", caminho: "/escola/caderneta", pacote: "E4-14", naFaixa: true, provisoria: true },
  { chave: "carteirinha", caminho: "/escola/carteirinha", pacote: "E4-08" },
  { chave: "plano", caminho: "/escola/plano", pacote: "E4-08" },
  { chave: "vozes", caminho: "/escola/vozes", pacote: "E4-11", provisoria: true },
  { chave: "lutas", caminho: "/escola/lutas", pacote: "E4-11", provisoria: true },
  { chave: "assembleia", caminho: "/escola/assembleia", pacote: "E4-12", provisoria: true },
  { chave: "ouvidoria", caminho: "/escola/ouvidoria", pacote: "E4-12", provisoria: true },
  { chave: "educador-do-mes", caminho: "/escola/educador-do-mes", pacote: "E4-12", provisoria: true },
  { chave: "provas", caminho: "/escola/provas", pacote: "E4-13" },
  { chave: "saberes", caminho: "/escola/saberes", pacote: "E4-13" },
  { chave: "formatura", caminho: "/escola/formatura", pacote: "E4-14", provisoria: true },
];

/** As da faixa de navegação, na ordem. */
export const FAIXA_DA_ESCOLA = ROTAS_DA_ESCOLA.filter((r) => r.naFaixa);

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
