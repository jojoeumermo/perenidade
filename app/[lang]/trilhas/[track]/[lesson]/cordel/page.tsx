// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import Link from "@/components/Link";
import { OuvirComLeitor } from "@/components/radio/OuvirComLeitor";
import { loadLang } from "@/i18n";
import { defaultLocale, localePath } from "@/i18n/config";
import { textosDoSom } from "@/i18n/escola/som";
import { getTrack } from "@/lib/content";
import { autoriaDe, emRascunho, folhetoDe, listarFolhetos } from "@/lib/cordel";
import { nosIdiomasDoTexto } from "@/lib/params";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { xilogravura } from "@/lib/xilogravuras";
import "@/styles/escola-som.css";

type Props = PageProps<"/[lang]/trilhas/[track]/[lesson]/cordel">;

// O cordel da aula (Etapa 4, E4-06; docs/escola/som.md e content/cordel/LEIA-ME.md): só em português, como a zine e o
// texto puro. Os folhetos são poucos e montados no build; nos outros idiomas o endereço redireciona (308) para o
// português. Desligado o recurso "escola", a página não existe.
export const dynamicParams = true;

export function generateStaticParams() {
  if (!ligado("escola")) return [];
  return nosIdiomasDoTexto(listarFolhetos().map((f) => ({ params: { track: f.trilha, lesson: f.aula }, file: f.arquivo })));
}

function carregar(trackSlug: string, lessonSlug: string) {
  if (!ligado("escola")) return null;
  const track = getTrack(trackSlug, defaultLocale);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  const folheto = track && lesson ? folhetoDe(track.slug, lesson.slug) : null;
  return track && lesson && folheto ? { track, lesson, folheto } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const achado = carregar(trackSlug, lessonSlug);
  if (!achado) return {};
  const s = textosDoSom(defaultLocale).cordel;
  const meta = paginaMeta(lang, `/trilhas/${achado.track.slug}/${achado.lesson.slug}/cordel`, `${achado.folheto.titulo}: ${achado.lesson.title}`, s.lead);
  // Rascunho em revisão não vai para os buscadores.
  return emRascunho(achado.folheto) ? { ...meta, robots: { index: false } } : meta;
}

/** O folheto de cordel da aula: a capa com a xilogravura, as estrofes, o "Ouvir" com a voz do aparelho e a impressão em A5. */
export default async function CordelDaAula({ params }: Props) {
  const { lang } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const achado = carregar(trackSlug, lessonSlug);
  if (!achado) notFound();
  const { track, lesson, folheto } = achado;
  // Os folhetos só existem em português: os outros idiomas vão para o folheto em português (veja lib/params.ts).
  if (lang !== defaultLocale) permanentRedirect(localePath(defaultLocale, `/trilhas/${track.slug}/${lesson.slug}/cordel`));
  const s = textosDoSom(defaultLocale);
  const c = s.cordel;
  const aula = localePath(defaultLocale, `/trilhas/${track.slug}/${lesson.slug}`);
  const rascunho = emRascunho(folheto);

  return (
    <div className="cordel-pagina mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="no-print">
        <Link href={aula} className="inline-flex min-h-11 items-center font-sans text-sm text-ink-soft hover:text-oxblood">
          ← {c.voltar}
        </Link>
      </div>

      <article className="folheto-cordel mt-4" lang="pt-BR" aria-labelledby="cordel-titulo">
        {rascunho && (
          <div className="cordel-rascunho mb-5 border-2 border-[#c21f16] bg-folha p-4 font-sans" role="note" data-cordel-rascunho="">
            <p className="font-bold uppercase tracking-[0.06em] text-[#c21f16]">{c.rascunho}</p>
            <p className="mt-1 text-sm">{c.rascunhoTexto}</p>
            <Link href={aula} className="mt-2 inline-flex min-h-11 items-center font-semibold underline decoration-[#c21f16] underline-offset-4 hover:text-oxblood">
              {c.abrirAula}: {lesson.title} →
            </Link>
          </div>
        )}
        <header className="folheto-capa border-2 border-ink bg-folha px-5 pt-5 pb-4 text-center">
          <p className="rotulo">{c.rotulo}</p>
          <svg viewBox="0 0 120 40" aria-hidden className="folheto-xilo mx-auto mt-3 w-full max-w-[22rem] text-ink" fill="currentColor" dangerouslySetInnerHTML={{ __html: xilogravura(folheto.xilogravura) }} />
          <h1 id="cordel-titulo" className="mt-3 font-serif text-[2.1rem] font-semibold leading-tight sm:text-[2.6rem]">
            {folheto.titulo}
          </h1>
          <p className="mt-2 font-serif text-lg italic text-ink-soft">{c.baseado.replace("{titulo}", lesson.title).replace("{trilha}", track.title)}</p>
          <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-ink-soft">
            {c.autoria.replace("{autoria}", autoriaDe(folheto))}
            {!rascunho && folheto.revisadoPor && <> · {c.revisadoPor.replace("{nome}", folheto.revisadoPor)}</>}
            {" · "}
            {c.estrofes.replace("{n}", String(folheto.estrofes.length))}
          </p>
        </header>

        <div className="no-print mt-5 flex flex-wrap items-center gap-3">
          <OuvirComLeitor alvo="#cordel-versos" lang={defaultLocale} s={s.ouvir} />
          <BotaoImprimir texto={c.imprimir} />
          <p className="w-full font-sans text-xs text-ink-soft">{c.imprimirDica}</p>
        </div>

        <div id="cordel-versos" className="cordel-versos mt-6 font-serif text-[1.2rem] leading-[1.55]">
          {folheto.estrofes.map((estrofe, i) => (
            <p key={i} className="cordel-estrofe">
              {estrofe.map((verso, j) => (
                <span key={j} className="cordel-verso">
                  {verso}
                  {j < estrofe.length - 1 && <br />}
                </span>
              ))}
            </p>
          ))}
        </div>

        <footer className="folheto-pe mt-8 border-t-2 border-ink pt-3 font-sans text-xs text-ink-soft">
          <p>
            {rascunho ? `${c.rascunho}. ` : ""}
            {site.name} · {`${site.url}${aula}`.replace(/^https?:\/\//, "")}
          </p>
        </footer>
      </article>
    </div>
  );
}
