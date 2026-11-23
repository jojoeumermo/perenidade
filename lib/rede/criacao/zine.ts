// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 37: a zine imprimível. Os posts que o banco deixa sair (public.rede_p4_cc_zine_posts) viram uma folha A4 deitada
// que, dobrada e cortada no meio, é um livrinho de 8 páginas: a mesma folha da zine da aula (app/[lang]/trilhas/.../zine e as
// classes .folha-livrinho e .livrinho-quadro de app/globals.css). Tudo no aparelho: a folha vira PDF pelo "Imprimir" do navegador.
// Sem "@/" de propósito (roda nos testes).
import { cortar, textoSimples } from "../../zine";
import type { PostDaZine } from "./cliente";

/** Uma parte de uma página do miolo: um post (ou o pedaço dele que coube). */
export interface ParteDaZine {
  titulo: string | null;
  texto: string;
  /** Quem escreveu (codinome), ou nulo quando a pessoa escolheu esconder. */
  autora: string | null;
}

export interface PaginaDaZine {
  /** O número da página no livrinho (2 a 7 no miolo). */
  numero: number;
  partes: ParteDaZine[];
}

export interface Zine {
  capa: { titulo: string; subtitulo: string };
  /** As seis páginas do miolo (2 a 7), na ordem de leitura. */
  miolo: PaginaDaZine[];
  /** Os posts que não couberam (texto cortado ou post inteiro de fora). */
  cortados: number;
}

/** O que cabe numa página de 74 por 105 mm, na letra da zine (cerca de 600 letras). */
export const LETRAS_POR_PAGINA = 600;
/** Quantas páginas de miolo a folha tem. */
export const PAGINAS_DO_MIOLO = 6;
/** O máximo de posts (o banco recusa mais de 12). */
export const MAXIMO_DE_POSTS = 12;

/**
 * Distribui os posts pelas seis páginas do miolo, na ordem: cada post ocupa uma página inteira enquanto houver página para todos;
 * com mais de seis, os curtos dividem a página (até caber em 600 letras). Texto longo é cortado no fim de uma frase. A autora sai
 * pelo codinome, ou some de toda a zine com `esconderAutora`.
 */
export function montarZine(posts: readonly PostDaZine[], opcoes: { titulo: string; subtitulo?: string; esconderAutora: boolean }): Zine {
  const lista = posts.slice(0, MAXIMO_DE_POSTS).map((p) => ({
    titulo: p.titulo ? textoSimples(p.titulo) : null,
    texto: textoSimples(p.texto ?? ""),
    autora: opcoes.esconderAutora ? null : p.autor?.codinome || null,
  }));
  const miolo: PaginaDaZine[] = Array.from({ length: PAGINAS_DO_MIOLO }, (_, i) => ({ numero: i + 2, partes: [] }));
  let cortados = Math.max(0, posts.length - MAXIMO_DE_POSTS);
  if (lista.length <= PAGINAS_DO_MIOLO) {
    lista.forEach((p, i) => {
      const texto = cortar(p.texto, LETRAS_POR_PAGINA - (p.titulo?.length ?? 0));
      if (texto.length < p.texto.length) cortados++;
      miolo[i].partes.push({ ...p, texto });
    });
  } else {
    // Mais posts que páginas: cada página recebe a sua parte justa, e os posts dividem as letras dela.
    const porPagina = Math.ceil(lista.length / PAGINAS_DO_MIOLO);
    lista.forEach((p, i) => {
      const pagina = miolo[Math.min(PAGINAS_DO_MIOLO - 1, Math.floor(i / porPagina))];
      const naPagina = Math.min(porPagina, lista.length - Math.floor(i / porPagina) * porPagina);
      const espaco = Math.floor(LETRAS_POR_PAGINA / naPagina) - (p.titulo?.length ?? 0);
      const texto = cortar(p.texto, Math.max(80, espaco));
      if (texto.length < p.texto.length) cortados++;
      pagina.partes.push({ ...p, texto });
    });
  }
  return {
    capa: { titulo: (opcoes.titulo ?? "").trim() || "Zine", subtitulo: (opcoes.subtitulo ?? "").trim() },
    miolo,
    cortados,
  };
}

/**
 * A ordem dos quadros na folha (4 por 2), da esquerda para a direita: a fileira de cima de cabeça para baixo (páginas 5, 4, 3 e 2)
 * e a de baixo em pé (6, 7, a contracapa 8 e a capa 1). É o que faz a dobra dar certo (a mesma da zine da aula).
 */
export const ORDEM_NA_FOLHA: readonly { pagina: number; invertida: boolean }[] = [
  { pagina: 5, invertida: true }, { pagina: 4, invertida: true }, { pagina: 3, invertida: true }, { pagina: 2, invertida: true },
  { pagina: 6, invertida: false }, { pagina: 7, invertida: false }, { pagina: 8, invertida: false }, { pagina: 1, invertida: false },
];

/** O id de um post a partir do que a pessoa colou: o próprio código, ou um endereço da Alumia que termina nele. */
export function idDoPost(colado: string): string | null {
  const m = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(colado.trim());
  return m ? m[1].toLowerCase() : null;
}
