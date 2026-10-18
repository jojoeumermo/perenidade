// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { defaultLocale, locales } from "@/i18n/config";
import { getTracks } from "@/lib/content";

// Para a seção Traduções do painel: cada aula escrita e os idiomas em que ela ainda não tem tradução. Arquivo estático,
// só em português (é a língua do painel).
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ lang: defaultLocale }];
}

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/traducoes.json">) {
  const { lang } = await loadLang(params);
  const outros = locales.filter((locale) => locale !== defaultLocale);
  // Uma aula está traduzida num idioma quando o carregador encontrou o arquivo .<idioma>.md dela.
  const traduzidas = new Map(outros.map((locale) => [locale, new Set(getTracks(locale).flatMap((track) => track.lessons.filter((lesson) => lesson.translated).map((lesson) => `${track.slug}/${lesson.slug}`)))]));
  return Response.json(
    getTracks(lang).map((track) => ({
      slug: track.slug,
      title: track.title,
      area: track.area,
      lessons: track.lessons.map((lesson, posicao) => ({
        slug: lesson.slug,
        title: lesson.title,
        // Para escolher o que traduzir primeiro: o tamanho (minutos de leitura) e a posição na trilha (as primeiras são as mais lidas).
        minutos: lesson.minutes,
        posicao,
        faltam: outros.filter((locale) => !traduzidas.get(locale)?.has(`${track.slug}/${lesson.slug}`)),
      })),
    })),
  );
}
