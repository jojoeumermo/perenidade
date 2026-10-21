// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Dados estruturados (JSON-LD, schema.org) para os buscadores entenderem o que cada página é: a organização, o site, a
// trilha (curso), a aula (recurso de aprendizagem), a obra do acervo (livro) e o caminho até a página (migalhas).
// Só o que a própria página já mostra: nada de autor, data ou nota inventados, e nenhuma pessoa física como responsável.
import { htmlLang, type Locale } from "@/i18n/config";
import type { Book, Lesson, Track } from "@/lib/content";
import { site } from "@/lib/site";

export type JsonLd = Record<string, unknown>;

const ORGANIZACAO_ID = `${site.url}/#organizacao`;
const SITE_ID = `${site.url}/#site`;

/** O instituto como organização: nome, endereço, logotipo, Instagram e o e-mail público. */
export function organizacao(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": ORGANIZACAO_ID,
    name: site.name,
    url: site.url,
    logo: `${site.url}/icone-512.png`,
    email: site.newsletter,
    sameAs: [site.instagram],
    isAccessibleForFree: true,
  };
}

/** O site, no idioma da página. Sem caixa de busca: a busca interna não é indexada. */
export function siteWeb(lang: Locale, descricao: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: site.name,
    url: `${site.url}/${lang}`,
    description: descricao,
    inLanguage: htmlLang[lang],
    publisher: { "@id": ORGANIZACAO_ID },
  };
}

/** O caminho até a página: [nome, caminho sem o idioma]. */
export function migalhas(lang: Locale, passos: [string, string][]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: passos.map(([nome, caminho], i) => ({ "@type": "ListItem", position: i + 1, name: nome, item: `${site.url}/${lang}${caminho}` })),
  };
}

/** O idioma em que o texto aparece de fato: o original (pt) quando a tradução não existe. */
const idiomaDoTexto = (lang: Locale, traduzido: boolean) => (traduzido ? htmlLang[lang] : htmlLang.pt);

/** Uma trilha como curso gratuito, com as aulas já escritas. */
export function curso(lang: Locale, trilha: Track): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: trilha.title,
    description: trilha.summary,
    url: `${site.url}/${lang}/trilhas/${trilha.slug}`,
    inLanguage: idiomaDoTexto(lang, trilha.translated),
    isAccessibleForFree: true,
    provider: { "@id": ORGANIZACAO_ID },
    hasPart: trilha.lessons.slice(0, 60).map((aula) => ({ "@type": "LearningResource", name: aula.title, url: `${site.url}/${lang}/trilhas/${trilha.slug}/${aula.slug}` })),
  };
}

/** Uma aula como recurso de aprendizagem. O autor só entra se a aula diz quem escreveu. */
export function recursoDeAula(lang: Locale, trilha: Track, aula: Lesson): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: aula.title,
    description: aula.summary,
    url: `${site.url}/${lang}/trilhas/${trilha.slug}/${aula.slug}`,
    inLanguage: idiomaDoTexto(lang, aula.translated),
    isAccessibleForFree: true,
    learningResourceType: "lesson",
    timeRequired: aula.minutes > 0 ? `PT${aula.minutes}M` : undefined,
    isPartOf: { "@type": "Course", name: trilha.title, url: `${site.url}/${lang}/trilhas/${trilha.slug}` },
    ...(aula.authors.length ? { author: aula.authors.map((nome) => ({ "@type": "Person", name: nome })) } : {}),
    publisher: { "@id": ORGANIZACAO_ID },
  };
}

/** Uma obra do acervo, só com os metadados que a ficha já tem. */
export function livro(lang: Locale, obra: Book): JsonLd {
  const ano = obra.year && /^\d{3,4}$/.test(obra.year.trim()) ? obra.year.trim() : undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: obra.title,
    url: `${site.url}/${lang}/acervo/${obra.id}`,
    ...(obra.author ? { author: { "@type": "Person", name: obra.author } } : {}),
    ...(ano ? { datePublished: ano } : {}),
    ...(obra.language ? { inLanguage: obra.language } : {}),
    ...(obra.synopsis ? { description: obra.synopsis.slice(0, 500) } : {}),
    ...(obra.cover ? { image: `${site.url}${obra.cover}` } : {}),
    isAccessibleForFree: true,
    sameAs: obra.url || undefined,
  };
}

/** O JSON pronto para ir dentro de <script type="application/ld+json">: "<" escapado para não fechar a tag. */
export function emTexto(dados: JsonLd | JsonLd[]): string {
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}
