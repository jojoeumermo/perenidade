// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Capa } from "@/components/podcast/Capa";
import { ListaDeEpisodios } from "@/components/podcast/Explorar";
import { PergunteAoPodcast } from "@/components/podcast/Participar";
import { Compartilhar, Conversa, TocadorDoEpisodio, Transcricao } from "@/components/podcast/Partes";
import { loadLang } from "@/i18n";
import { htmlLang, localePath } from "@/i18n/config";
import { arquivoPublico, enderecoDoAudio, minutos } from "@/lib/podcast";
import { catalogo, episodio } from "@/lib/podcast-servidor";
import { site } from "@/lib/site";

// Cada episódio é montado na primeira visita e refeito a cada cinco minutos: correção no painel chega logo.
export const revalidate = 1800;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/podcasts/[slug]">): Promise<Metadata> {
  const { t } = await loadLang(params);
  const e = await episodio((await params).slug);
  if (!e) return { title: t.podcast.title };
  const imagem = arquivoPublico(e.capa);
  return {
    title: `${e.titulo} · ${t.podcast.title}`,
    description: e.resumo,
    openGraph: { type: "music.song", title: e.titulo, description: e.resumo, images: imagem ? [{ url: imagem, width: 3000, height: 3000 }] : undefined, audio: enderecoDoAudio(e) || undefined },
    alternates: { types: { "application/rss+xml": `${site.url}/podcast.xml` } },
  };
}

export default async function PaginaDoEpisodio({ params }: PageProps<"/[lang]/podcasts/[slug]">) {
  const { lang, t } = await loadLang(params);
  const s = t.podcast;
  const slug = (await params).slug;
  const [e, tudo] = await Promise.all([episodio(slug), catalogo()]);
  if (!e) notFound();
  const programa = tudo.config?.nome || s.title;
  const data = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  // Mais para ouvir: primeiro da mesma série, depois da mesma disciplina, depois os mais novos.
  const outros = tudo.episodios
    .filter((x) => x.id !== e.id)
    .sort((a, b) => Number(b.serie?.slug === e.serie?.slug && Boolean(e.serie)) - Number(a.serie?.slug === e.serie?.slug && Boolean(e.serie)) || Number(b.disciplina === e.disciplina && Boolean(e.disciplina)) - Number(a.disciplina === e.disciplina && Boolean(e.disciplina)))
    .slice(0, 5);
  const audio = enderecoDoAudio(e);
  const h2 = "font-mono text-xs uppercase tracking-[0.2em] text-gold";

  return (
    <article className="mx-auto max-w-6xl px-4 py-8">
      <Link href={localePath(lang, "/podcasts")} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {s.title}</Link>

      <header className="mt-6 grid gap-6 md:grid-cols-[minmax(0,20rem)_1fr]">
        <Capa caminho={e.capa} titulo={e.titulo} numero={e.numero} grande className="border-4 border-ink" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-[0.2em]">
            <span className="bg-[#c21f16] px-1.5 py-0.5 text-white">{s.episode}{e.numero != null ? ` ${e.numero}` : ""}</span>
            <span className="text-gold" lang="pt-BR">{[e.serie?.titulo ?? programa, e.temporada ? `${s.season} ${e.temporada}` : ""].filter(Boolean).join(" · ")}</span>
          </p>
          <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] sm:text-5xl" lang="pt-BR">{e.titulo}</h1>
          <p className="mt-3 font-mono text-xs text-ink-soft">
            {data.format(new Date(e.publicado_em))} · {minutos(e.duracao)}
            {e.plays > 0 && ` · ${e.plays} ${s.plays}`}
          </p>
          {e.convidados && e.convidados.length > 0 && (
            <p className="mt-2 font-sans text-sm" lang="pt-BR">
              <span className="text-ink-soft">{s.guests}:</span> {e.convidados.map((c) => c.nome).join(", ")}
            </p>
          )}
          {e.resumo && <p className="mt-4 max-w-2xl text-xl leading-snug" lang="pt-BR">{e.resumo}</p>}
          <TocadorDoEpisodio e={e} programa={programa} s={s} />
          <p className="mt-6 flex flex-wrap items-center gap-3">
            <Compartilhar titulo={e.titulo} s={s} />
            {audio && (
              <a href={audio} download className="border-2 border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">
                {s.download}
              </a>
            )}
            <a href="/podcast.xml" className="border-2 border-dashed border-ink px-4 py-2 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood">RSS</a>
          </p>
          <p className="mt-4 flex flex-wrap gap-2 font-sans text-xs font-semibold">
            {e.temas.map((tema) => (
              <span key={tema} className="rounded-full border border-ink px-3 py-1">{s.themes[tema as keyof typeof s.themes] ?? tema}</span>
            ))}
            {e.disciplina && (
              <Link href={localePath(lang, `/estantes/${e.disciplina}`)} className="rounded-full bg-ink px-3 py-1 text-parchment hover:bg-oxblood">
                {t.areas[e.disciplina as keyof typeof t.areas]?.[0] ?? e.disciplina} →
              </Link>
            )}
          </p>
        </div>
      </header>

      <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          {e.notas && (
            <section aria-labelledby="notas">
              <h2 id="notas" className={h2}>{s.notes}</h2>
              <div className="mt-3" lang="pt-BR">
                <Markdown lang={lang}>{e.notas}</Markdown>
              </div>
            </section>
          )}
          {e.obras && e.obras.length > 0 && (
            <section aria-labelledby="obras">
              <h2 id="obras" className={h2}>{s.citedWorks}</h2>
              <ul className="mt-3 divide-y divide-rule border-y-2 border-ink" lang="pt-BR">
                {e.obras.map((obra) => (
                  <li key={obra.id} className="py-3">
                    <Link href={localePath(lang, `/acervo/${obra.id}`)} className="font-serif text-xl font-semibold hover:text-oxblood">{obra.titulo}</Link>
                    <p className="font-sans text-sm text-ink-soft">{[obra.autor, obra.licenca, obra.fonte].filter(Boolean).join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {e.fontes && e.fontes.length > 0 && (
            <section aria-labelledby="fontes">
              <h2 id="fontes" className={h2}>{s.sources}</h2>
              <ol className="mt-3 list-decimal space-y-1 pl-5 font-sans text-sm" lang="pt-BR">
                {e.fontes.map((fonte, i) => (
                  <li key={i}>
                    {fonte.url ? <a href={fonte.url} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-oxblood">{fonte.titulo}</a> : fonte.titulo}
                    {fonte.autor && <span className="text-ink-soft"> · {fonte.autor}</span>}
                    {fonte.ano && <span className="text-ink-soft"> ({fonte.ano})</span>}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {(e.transcricao || e.legendas) && (
            <section aria-labelledby="transcricao">
              <h2 id="transcricao" className={h2}>{s.transcript}</h2>
              <Transcricao e={e} programa={programa} s={s} />
              {e.legendas && (
                <p className="mt-3 font-sans text-sm">
                  <a href={localePath(lang, `/podcasts/${e.slug}/legendas.vtt`)} className="underline hover:text-oxblood">{s.downloadCaptions}</a>
                </p>
              )}
            </section>
          )}
          {e.topico && (
            <section aria-labelledby="conversa">
              <h2 id="conversa" className={h2}>{s.conversation}</h2>
              <Conversa topico={e.topico} s={s} />
            </section>
          )}
        </div>
        <aside className="space-y-8">
          {e.convidados && e.convidados.some((c) => c.minibio) && (
            <section aria-labelledby="quem" className="border-l-4 border-ink pl-4" lang="pt-BR">
              <h2 id="quem" className={h2}>{s.guests}</h2>
              {e.convidados.map((c) => (
                <p key={c.nome} className="mt-2">
                  <strong className="font-serif text-lg">{c.nome}</strong>
                  {c.minibio && <span className="block text-sm text-ink-soft">{c.minibio}</span>}
                </p>
              ))}
            </section>
          )}
          <PergunteAoPodcast s={s} episodio={e.id} />
        </aside>
      </div>

      {outros.length > 0 && (
        <section aria-labelledby="mais" className="mt-16">
          <h2 id="mais" className="jornal-secao">
            <span className="jornal-editoria">{s.more}</span>
          </h2>
          <ListaDeEpisodios episodios={outros} s={s} lang={lang} programa={programa} />
        </section>
      )}
    </article>
  );
}
