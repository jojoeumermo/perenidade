// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { MetadataRoute } from "next";
import { defaultLocale, htmlLang, type Locale, locales } from "@/i18n/config";
import { areaSlugs, tools } from "@/lib/areas";
import { territorios } from "@/lib/territorios";
import { getArticles, getBooks, getTracks, idiomasDe } from "@/lib/content";
import { fileHistory } from "@/lib/history";
import { site } from "@/lib/site";

// Mapa do site para os buscadores. Cada endereço aparece uma vez por idioma, com a indicação das
// versões nos outros idiomas (hreflang), para o buscador mostrar a versão certa a cada pessoa. Aula e obra entram só
// nos idiomas em que o texto existe: as outras versões mostram o texto em português e já apontam o português como
// canônico (lib/seo.ts), então anunciá-las aqui era mandar o buscador atrás de cópia.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/trilhas",
    "/acervo",
    "/jornal",
    "/noticias",
    "/comunidade",
    "/memorial",
    "/dedicatoria",
    "/contribuir",
    "/apoie",
    "/apoie/contas",
    "/estudio-de-pratica",
    "/estudo-em-grupo",
    "/estudio-de-pratica/antes-de-comecar",
    "/explorar",
    "/autores",
    "/voluntarios",
    "/glossario",
    "/linha-do-tempo",
    "/galeria",
    "/ferramentas",
    "/checagens",
    "/dados",
    "/debates",
    "/falacias",
    "/perguntas",
    "/despertar",
    "/territorios",
    "/nucleos",
    "/turmas",
    "/relatorio",
    "/seguranca-digital",
    "/status",
    "/comecar",
    "/guia",
    "/videos",
    "/videoaulas",
    "/mural",
    "/gaveta",
    "/gaveta/termo",
    "/materiais",
    "/sobre",
    "/quem-somos",
    "/questoes",
    "/laboratorios",
    "/laboratorios/ide",
    "/laboratorios/redes",
    "/laboratorios/linux",
    "/laboratorios/montador",
    "/laboratorios/ia",
    "/laboratorios/escritorio",
    "/laboratorios/design",
    "/laboratorios/seguranca",
    "/laboratorios/simulacoes",
    "/laboratorios/eletrica",
    "/laboratorios/modelos",
    "/laboratorios/quimica",
    "/creditos",
    "/radio",
    "/privacidade",
    "/termos",
    "/instituto",
    "/sala-livre",
    "/saude/termo",
    "/saude/neutralidade",
    "/direitos-autorais",
    "/conduta",
    "/uso",
    "/contribuidores",
    "/direitos",
    "/criancas",
    "/criancas/adultos",
    "/criancas/letras",
    "/criancas/historias",
    "/criancas/contas",
    "/criancas/robo",
    "/criancas/seguranca",
    "/criancas/imprimir",
  ];
  for (const area of areaSlugs) paths.push(`/estantes/${area}`);
  for (const tool of tools) paths.push(`/ferramentas/${tool}`);
  for (const territorio of territorios) paths.push(`/territorios/${territorio.slug}`);
  // A data real da última alteração, lida do histórico do Git, só para o que tem arquivo próprio (aula, trilha, obra, matéria).
  const datas = new Map<string, string>();
  const soEm = new Map<string, readonly Locale[]>();
  const anotar = (path: string, file?: string) => {
    if (!file) return;
    const { updated } = fileHistory(file);
    if (updated) datas.set(path, updated);
  };
  for (const track of getTracks(defaultLocale)) {
    paths.push(`/trilhas/${track.slug}`);
    let ultima = "";
    for (const lesson of track.lessons) {
      paths.push(`/trilhas/${track.slug}/${lesson.slug}`);
      soEm.set(`/trilhas/${track.slug}/${lesson.slug}`, idiomasDe(lesson.file));
      anotar(`/trilhas/${track.slug}/${lesson.slug}`, lesson.file);
      const d = datas.get(`/trilhas/${track.slug}/${lesson.slug}`);
      if (d && d > ultima) ultima = d;
    }
    if (ultima) datas.set(`/trilhas/${track.slug}`, ultima);
  }
  for (const book of getBooks(defaultLocale)) {
    paths.push(`/acervo/${book.id}`);
    soEm.set(`/acervo/${book.id}`, idiomasDe(book.file));
    anotar(`/acervo/${book.id}`, (book as { file?: string }).file);
  }
  for (const article of getArticles(defaultLocale)) {
    paths.push(`/jornal/${article.slug}`);
    anotar(`/jornal/${article.slug}`, (article as { file?: string }).file);
  }
  return paths.flatMap((path) => {
    const idiomas = soEm.get(path) ?? locales;
    const languages = { ...Object.fromEntries(idiomas.map((code) => [htmlLang[code], `${site.url}/${code}${path}`])), "x-default": `${site.url}/${defaultLocale}${path}` };
    const data = datas.get(path);
    return idiomas.map((lang) => ({
      url: `${site.url}/${lang}${path}`,
      ...(data ? { lastModified: new Date(data) } : {}),
      alternates: { languages },
    }));
  });
}
