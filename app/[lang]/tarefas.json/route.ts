// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { loadLang } from "@/i18n";
import { locales } from "@/i18n/config";
import { areaSlugs } from "@/lib/areas";
import { getBooks, getLooseMaterials, getTracks, getVideos } from "@/lib/content";

// O retrato do que falta em cada disciplina, para o "Por onde começar" do painel: aulas em preparação, traduções,
// obras do acervo e materiais avulsos. Arquivo estático, refeito a cada publicação do site; não diz nada sobre pessoas.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

const outras = ["en", "es", "zh", "ru"] as const;

export async function GET(_request: Request, { params }: RouteContext<"/[lang]/tarefas.json">) {
  const { lang } = await loadLang(params);
  const tracks = getTracks(lang);
  // Quantas aulas de cada trilha já existem em cada idioma além do português.
  const traduzidas = Object.fromEntries(
    outras.map((idioma) => [idioma, new Map(getTracks(idioma).map((track) => [track.slug, track.lessons.filter((lesson) => lesson.translated).length]))]),
  );
  const books = getBooks(lang);
  const loose = getLooseMaterials(lang);
  const videos = getVideos(lang);
  return Response.json(
    Object.fromEntries(
      areaSlugs.map((area) => [
        area,
        {
          obras: books.filter((book) => book.area === area).length,
          avulsos: loose.filter((material) => material.area === area).length,
          videos: videos.filter((video) => video.area === area).length,
          trilhas: tracks
            .filter((track) => track.area === area)
            .map((track) => ({
              slug: track.slug,
              titulo: track.title,
              etapa: track.stage,
              prontas: track.lessons.length,
              // Só as próximas três aulas do roteiro e o total: é o que a Mesa precisa, e o arquivo fica leve.
              faltam: track.plan.filter((item) => !item.ready).slice(0, 3).map((item) => ({ slug: item.slug, titulo: item.title })),
              quantasFaltam: track.plan.filter((item) => !item.ready).length,
              traduzidas: Object.fromEntries(outras.map((idioma) => [idioma, traduzidas[idioma].get(track.slug) ?? 0])),
            })),
        },
      ]),
    ),
  );
}
