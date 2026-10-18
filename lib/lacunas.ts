// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O verificador do acervo: lê o conteúdo publicado e aponta cada lacuna que vira tarefa no painel ("Para você hoje").
// Sem inteligência artificial: regras simples sobre os campos que existem de verdade nas obras, aulas e autores. Roda no
// build (o arquivo /pt/lacunas.json) e a rotina de publicação leva o resultado ao banco, que abre e fecha as tarefas.
import { locales, defaultLocale } from "@/i18n/config";
import { getAuthors, getBooks, getTracks } from "./content";
import { normalize } from "./text";
import { type TipoDeLacuna, TIPOS } from "./tipos-de-tarefa";

export { TIPOS, type TipoDeLacuna };


export interface Lacuna {
  /** Identidade estável: a mesma lacuna gera sempre a mesma chave (o banco não abre duas tarefas iguais). */
  chave: string;
  tipo: TipoDeLacuna;
  /** Onde fica (endereço sem o idioma) e o que é. */
  alvo: string;
  titulo: string;
  detalhe: string;
}


const SINOPSE_MINIMA = 120;

/** As obras (e o que falta em cada ficha), para o verificador e para a página "Acervo por dentro". */
export function fichasDoAcervo() {
  const books = getBooks(defaultLocale);
  return books.map((b) => {
    const faltam: string[] = [];
    if (!b.year) faltam.push("ano");
    if (b.synopsis.trim().length < SINOPSE_MINIMA) faltam.push("sinopse");
    if (b.license === "Conforme a fonte") faltam.push("licença a conferir");
    const completude = faltam.length === 0 ? "completa" : faltam.length >= 2 ? "vazia" : "parcial";
    return { id: b.id, titulo: b.title, autor: b.author, area: b.area, licenca: b.license, ano: b.year ?? "", url: b.url, faltam, completude };
  });
}

/** Todas as lacunas do conteúdo publicado. */
export function lacunas(): Lacuna[] {
  const saida: Lacuna[] = [];
  const books = getBooks(defaultLocale);
  const tracks = getTracks(defaultLocale);
  const autores = new Set(getAuthors(defaultLocale).map((a) => a.slug));

  // Fichas das obras
  for (const b of books) {
    const alvo = `/acervo/${b.id}`;
    if (!b.year) saida.push({ chave: `ficha_ano:${b.id}`, tipo: "ficha_ano", alvo, titulo: b.title, detalhe: `${b.author}` });
    if (b.synopsis.trim().length < SINOPSE_MINIMA) saida.push({ chave: `ficha_sinopse:${b.id}`, tipo: "ficha_sinopse", alvo, titulo: b.title, detalhe: `A sinopse tem ${b.synopsis.trim().length} caracteres.` });
    if (b.license === "Conforme a fonte") saida.push({ chave: `licenca:${b.id}`, tipo: "licenca", alvo, titulo: b.title, detalhe: `Fonte: ${b.source}` });
  }

  // Obras que nenhuma aula indica
  const citadas = new Set<string>();
  for (const t of tracks) for (const l of t.lessons) for (const m of l.body.matchAll(/\/acervo\/([a-z0-9-]+)/g)) citadas.add(m[1]);
  for (const b of books) if (!citadas.has(b.id)) saida.push({ chave: `sem_ligacao:${b.id}`, tipo: "sem_ligacao", alvo: `/acervo/${b.id}`, titulo: b.title, detalhe: `Disciplina: ${b.area}` });

  // Autores com três obras ou mais e sem página
  const porAutor = new Map<string, { nome: string; n: number }>();
  for (const b of books) b.authorSlugs.forEach((slug, i) => { const nome = b.author.split(/\s*[,;&]\s*|\s+e\s+/)[i] ?? b.author; const x = porAutor.get(slug) ?? { nome, n: 0 }; x.n++; porAutor.set(slug, x); });
  for (const [slug, { nome, n }] of porAutor) if (n >= 3 && !autores.has(slug)) saida.push({ chave: `biografia:${slug}`, tipo: "biografia", alvo: `/autores/${slug}`, titulo: nome, detalhe: `${n} obras no acervo e nenhuma biografia.` });

  // Possíveis repetidas: mesmo título e autor depois de tirar acento, pontuação e o que vem entre parênteses
  const vistos = new Map<string, string>();
  const chaveDe = (b: (typeof books)[number]) => `${normalize(b.title.replace(/\(.*?\)/g, "")).replace(/[^a-z0-9]+/g, " ").trim()}|${normalize(b.author).replace(/[^a-z0-9]+/g, " ").trim()}`;
  for (const b of books) {
    const k = chaveDe(b);
    const outro = vistos.get(k);
    if (outro) saida.push({ chave: `duplicata:${[outro, b.id].sort().join("+")}`, tipo: "duplicata", alvo: `/acervo/${b.id}`, titulo: b.title, detalhe: `Parecida com /acervo/${outro}` });
    else vistos.set(k, b.id);
  }

  // Aulas: tradução faltando em cada idioma, revisão e imagens sem descrição
  const outros = locales.filter((l) => l !== defaultLocale);
  const traduzidas = new Map(outros.map((l) => [l, new Set(getTracks(l).flatMap((t) => t.lessons.filter((x) => x.translated).map((x) => `${t.slug}/${x.slug}`)))]));
  for (const t of tracks) {
    t.lessons.forEach((l) => {
      const alvo = `/trilhas/${t.slug}/${l.slug}`;
      for (const idioma of outros) if (!traduzidas.get(idioma)?.has(`${t.slug}/${l.slug}`)) saida.push({ chave: `traducao:${alvo}:${idioma}`, tipo: "traducao", alvo, titulo: l.title, detalhe: idioma });
      if (!l.reviewed) saida.push({ chave: `revisao_aula:${alvo}`, tipo: "revisao_aula", alvo, titulo: l.title, detalhe: t.title });
      const semAlt = [...l.body.matchAll(/!\[\s*\]\(([^)\s]+)/g)].map((m) => m[1]);
      for (const src of semAlt) saida.push({ chave: `imagem_alt:${alvo}:${src}`, tipo: "imagem_alt", alvo, titulo: l.title, detalhe: src });
    });
  }
  return saida;
}

/** Os números da saúde do acervo (sem nenhum dado de pessoa). */
export function saudeDoAcervo(fichas = fichasDoAcervo(), todas = lacunas()) {
  const porTipo: Record<string, number> = {};
  for (const l of todas) porTipo[l.tipo] = (porTipo[l.tipo] ?? 0) + 1;
  const traducaoPorIdioma: Record<string, number> = {};
  for (const l of todas) if (l.tipo === "traducao") traducaoPorIdioma[l.detalhe] = (traducaoPorIdioma[l.detalhe] ?? 0) + 1;
  return {
    obras: fichas.length,
    fichas_completas: fichas.filter((f) => f.completude === "completa").length,
    licencas_a_conferir: fichas.filter((f) => f.faltam.includes("licença a conferir")).length,
    aulas: getTracks(defaultLocale).reduce((n, t) => n + t.lessons.length, 0),
    traducao_por_idioma: traducaoPorIdioma,
    por_tipo: porTipo,
  };
}
