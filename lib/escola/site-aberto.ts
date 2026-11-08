// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// F7 da Escola (docs/plano-2026-11/PLANO-ESCOLA.md, prancha Mapa): a Escola virou formação militante, fechada, e o que não
// é formação militante voltou ao site aberto. Os endereços antigos redirecionam para os novos (308, next.config.ts).
// Sem os atalhos "@/" de propósito: os roteiros de conferência rodam este arquivo direto no Node.

/** As seções que saíram de /escola, com o endereço novo (sem o idioma). */
export const SAIRAM_DA_ESCOLA = [
  { de: "/escola/cursos", para: "/cursos" },
  { de: "/escola/campus", para: "/campus" },
  { de: "/escola/vida", para: "/vida" },
] as const;

/** As páginas abertas da vida real (o hub e as quatro de baixo), para o mapa do site. */
export const PAGINAS_DA_VIDA = ["/vida", "/vida/tarefas", "/vida/missoes", "/vida/caso-do-bairro", "/vida/documentos"] as const;

/**
 * Cursos que são formação militante e passaram para a Formação da Escola (caderno 11): ficam fora da vitrine aberta de
 * /cursos e do mapa do site. A página de cada um continua no endereço de sempre (o texto das aulas é público, /trilhas).
 */
export const CURSOS_DA_FORMACAO: readonly string[] = ["ano-de-formacao-politica"];

export const cursoAberto = (slug: string) => !CURSOS_DA_FORMACAO.includes(slug);
