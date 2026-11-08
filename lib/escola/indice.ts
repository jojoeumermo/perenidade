// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As páginas da Escola Revolucionária Lúcia Maria no índice da busca (Etapa 4, E4-05) e os textos da busca viva (i18n/escola/busca).
// lib/indice-de-busca.ts acrescenta estas entradas só com ligado("escola"); a do modo seguro entra sempre, porque o
// modo seguro existe com ou sem a Escola. Os cursos (E4-07) entram aqui, cada um como página: título, resumo e área.
// Este arquivo LÊ o disco (os cursos): só a busca do servidor (lib/indice-de-busca.ts) pode importá-lo. Layout, rodapé e
// páginas importam os textos de lib/escola/textos-da-busca.ts; componente de cliente importa só tipos.
// Sem os atalhos "@/" de propósito (lib testável no Node).
import type { SearchEntry } from "../search";
import { textosDosCursos } from "../../i18n/escola/cursos/index";
import { carregarCursos } from "./cursos-servidor";
import { cursoAberto } from "./site-aberto";
import type { TextosDaBusca } from "./textos-da-busca";

// Os textos moram em textos-da-busca.ts, que não lê o disco (o layout raiz importa de lá). Reexportados aqui para os
// testes e para quem já importava deste arquivo.
export { textosDaBusca } from "./textos-da-busca";
export type { TextosDaBusca } from "./textos-da-busca";

/** As páginas da Escola que entram na busca: a chave do texto (título e descrição) e o caminho. */
const PAGINAS_DA_ESCOLA = [
  ["entrada", "/escola"],
  ["quemFoi", "/escola/quem-foi-lucia-maria"],
  ["cursos", "/cursos"],
  ["matricula", "/escola/matricula"],
  ["calendario", "/escola/calendario"],
  ["campus", "/campus"],
  ["turmas", "/escola/turmas"],
  ["acompanhante", "/escola/acompanhante"],
  ["caderneta", "/escola/caderneta"],
  ["formatura", "/escola/formatura"],
  ["vida", "/vida"],
  ["vozes", "/escola/vozes"],
  ["lutas", "/escola/lutas"],
  ["assembleia", "/escola/assembleia"],
  ["ouvidoria", "/escola/ouvidoria"],
  ["educadorDoMes", "/escola/educador-do-mes"],
  ["agentes", "/escola/agentes"],
] as const;

/** A entrada do modo seguro (sempre no índice: quem procura "saída rápida" precisa achar, com ou sem a Escola). */
export function entradaDoModoSeguro(t: TextosDaBusca): SearchEntry {
  return { kind: "pagina", title: t.indice.modoSeguro, href: "/modo-seguro", area: "", context: "", text: t.indice.modoSeguroTexto };
}

/**
 * Os cursos da Escola (content/escola/cursos), cada um como uma página da busca: o título e o resumo do curso (em
 * português, como o conteúdo) e a área. O contexto diz "Curso da Escola" no idioma da busca. O tipo é "pagina" porque
 * lib/search.ts ainda não tem o tipo "curso" (pedido no relatório do E4-07). Só os cursos abertos (F7, cursoAberto): os da
 * Formação ficam fora da busca, como ficam fora de /cursos e do mapa do site.
 */
export function entradasDosCursos(lang: string): SearchEntry[] {
  const contexto = textosDosCursos(lang).busca.contexto;
  return carregarCursos()
    .filter((c) => cursoAberto(c.slug))
    .map((c) => ({ kind: "pagina", title: c.titulo, href: `/cursos/${c.slug}`, area: c.area, context: contexto, text: `${c.resumo} ${c.objetivo}` }));
}

/** As páginas da Escola (entrada, quem foi Lúcia Maria, cursos, matrícula, calendário, campus, turmas, acompanhante, caderneta, formatura, vida, vozes, lutas, assembleia, ouvidoria, educador do mês, agentes), os cursos e o modo seguro (por último). */
export function entradasDaEscola(lang: string, t: TextosDaBusca): SearchEntry[] {
  const i = t.indice;
  const entradas = PAGINAS_DA_ESCOLA.map(([chave, href]): SearchEntry => ({
    kind: "pagina",
    title: i[chave],
    href,
    area: "",
    context: chave === "entrada" ? "" : i.contexto,
    text: i[`${chave}Texto`],
  }));
  return [...entradas, ...entradasDosCursos(lang), entradaDoModoSeguro(t)];
}

/** Os caminhos das páginas da Escola no índice (para o teste conferir que existem). */
export const CAMINHOS_DA_ESCOLA: readonly string[] = PAGINAS_DA_ESCOLA.map(([, href]) => href);
