// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import despertar from "@/content/despertar.json";
import { originalLang, Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getBooks, getTracks } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";

interface Etapa {
  id: string;
  titulo: string;
  pergunta: string;
  texto: string;
  aulas: string[];
  leituras: string[];
  tarefa: string;
  roda: string[];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/despertar">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/despertar", t.despertar.title, t.despertar.lead);
}

/**
 * O percurso Despertar: do zero à consciência de classe e à organização, em cinco etapas. Cada etapa junta aulas de
 * várias disciplinas (as prontas abrem; as que ainda faltam escrever aparecem como "em preparação"), uma leitura do
 * acervo, uma tarefa no mundo real e o roteiro de um encontro de núcleo. O texto das etapas está em content/despertar.json.
 */
export default async function Despertar({ params }: PageProps<"/[lang]/despertar">) {
  const { lang, t } = await loadLang(params);
  const s = t.despertar;
  const to = (path: string) => localePath(lang, path);
  const etapas = despertar.etapas as Etapa[];

  // Cada aula do percurso, procurada nas trilhas: pronta (abre) ou prevista no roteiro da trilha (em preparação).
  const trilhas = new Map(getTracks(lang).map((track) => [track.slug, track]));
  const aula = (id: string) => {
    const [trilha, slug] = id.split("/");
    const track = trilhas.get(trilha);
    if (!track) return null;
    const pronta = track.lessons.find((l) => l.slug === slug);
    if (pronta) return { titulo: pronta.title, trilha: track.title, href: to(`/trilhas/${trilha}/${slug}`), pronta: true };
    const prevista = track.plan.find((p) => p.slug === slug);
    return prevista ? { titulo: prevista.title, trilha: track.title, href: to(`/trilhas/${trilha}`), pronta: false } : null;
  };
  const obras = new Map(getBooks(lang).map((book) => [book.id, book]));
  const prontas = etapas.flatMap((e) => e.aulas).map(aula).filter((a) => a?.pronta).length;

  return (
    <>
      <section className="capa-preta relative overflow-hidden border-b-4 border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[repeating-conic-gradient(from_0deg_at_88%_40%,#2a231b_0_6deg,#1f1a14_6deg_12deg)]" />
        <div className="relative mx-auto grid max-w-[78rem] items-end gap-10 px-4 py-14 sm:px-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:px-8 lg:py-16">
          <div className="min-w-0">
            <p className="rotulo text-[#e0837a]!">{s.eyebrow}</p>
            <h1 className="lambe mt-4 text-[5rem] leading-[0.85] sm:text-[7rem]">{s.title}</h1>
            <p className="mt-6 max-w-[38rem] font-serif text-[1.6rem] leading-snug max-md:text-xl">{s.lead}</p>
            <div className="mt-8 flex flex-wrap gap-3.5">
              <a href="#olhar" className="botao botao-prelo">{s.start}</a>
              <Link href={to("/estudo-em-grupo")} className="botao border-[#f4ecd8]! bg-transparent! text-[#f4ecd8]!">{s.group}</Link>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-5 border-2 border-[#f4ecd8] p-6">
            {[
              [String(etapas.length), s.stats.stages],
              [String(prontas), s.stats.lessons],
              [String(etapas.length), s.stats.tasks],
              ["0", s.stats.price],
            ].map(([valor, nome]) => (
              <div key={nome}>
                <dd className="font-serif text-[2.8rem] font-semibold leading-none">{valor}</dd>
                <dt className="mt-1 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-[#b3a584]">{nome}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-[78rem] px-4 sm:px-6 lg:px-8">
        <p className="mt-12 max-w-3xl font-serif text-[1.45rem] leading-relaxed">{s.intro}</p>
        <Untranslated lang={lang} t={t} show={lang !== "pt"} />

        <ol className="mt-10 border-b-2 border-ink">
          {etapas.map((etapa, i) => (
            <li key={etapa.id} id={etapa.id} className="grid scroll-mt-36 gap-7 border-t-2 border-ink py-9 md:grid-cols-[7rem_minmax(0,1fr)_19rem]" {...originalLang(lang === "pt")}>
              <span aria-hidden className="lambe text-[5.5rem] leading-[0.8] text-prelo-texto">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="rotulo">{etapa.titulo}</p>
                <h2 className="mt-2 text-[2.4rem] font-semibold leading-[1.05] text-balance">{etapa.pergunta}</h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">{etapa.texto}</p>
                <ul className="mt-5 flex flex-col gap-1.5">
                  {etapa.aulas.map(aula).filter((a) => a !== null).map((a) => (
                    <li key={a.href + a.titulo} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className={`shrink-0 px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${a.pronta ? "bg-ink text-parchment" : "border border-dashed border-ink-soft text-ink-soft"}`}>
                        {a.pronta ? s.lesson : s.soon}
                      </span>
                      <Link href={a.href} className={`font-sans ${a.pronta ? "font-semibold text-ink hover:text-prelo-texto" : "text-ink-soft hover:text-ink"}`}>{a.titulo}</Link>
                      <span className="font-sans text-xs text-ink-soft">{a.trilha}</span>
                    </li>
                  ))}
                  {etapa.leituras.map((id) => obras.get(id)).filter((o) => o !== undefined).map((obra) => (
                    <li key={obra.id} className="flex flex-wrap items-baseline gap-x-3">
                      <span className="shrink-0 bg-[#e9dcbc] px-1.5 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink">{s.reading}</span>
                      <Link href={to(`/acervo/${obra.id}`)} className="font-sans font-semibold text-ink hover:text-prelo-texto">{obra.title}</Link>
                      <span className="font-sans text-xs text-ink-soft">{obra.author}</span>
                    </li>
                  ))}
                </ul>
                <details className="mt-5 max-w-2xl border-2 border-ink bg-folha">
                  <summary className="cursor-pointer px-4 py-2.5 font-sans text-sm font-bold">{s.circle}</summary>
                  <ol className="list-decimal space-y-2 px-4 pt-1 pb-4 pl-9 text-[1.05rem]">
                    {etapa.roda.map((pergunta) => <li key={pergunta}>{pergunta}</li>)}
                  </ol>
                </details>
              </div>
              <aside className={`self-start border-2 border-ink p-5 shadow-[5px_5px_0_var(--sombra)] ${i === etapas.length - 1 ? "bg-[#1f1a14] text-[#f4ecd8] shadow-[5px_5px_0_#c21f16]" : "bg-[#f9e7a6] text-[#1f1a14] " + (i % 2 ? "-rotate-1" : "rotate-1")}`}>
                <p className={`font-mono text-[0.66rem] uppercase tracking-[0.2em] ${i === etapas.length - 1 ? "text-[#e0837a]" : ""}`}>{i === etapas.length - 1 ? s.finalTask : s.task}</p>
                <p className="mt-2 font-serif text-xl italic leading-snug">{etapa.tarefa}</p>
              </aside>
            </li>
          ))}
        </ol>

        <div className="grid gap-7 py-14 md:grid-cols-2">
          <section className="cartao p-7">
            <p className="rotulo">{s.endKicker}</p>
            <h2 className="mt-2 text-[2rem] font-semibold leading-tight">{s.certTitle}</h2>
            <p className="mt-3 text-lg leading-relaxed text-ink-soft">{s.certText}</p>
          </section>
          <section className="border-2 border-ink bg-[#c21f16] p-7 text-white shadow-[6px_6px_0_var(--sombra)]">
            <p className="font-mono text-xs uppercase tracking-[0.2em]">{s.groupKicker}</p>
            <h2 className="mt-2 text-[2rem] font-semibold leading-tight">{s.groupTitle}</h2>
            <p className="mt-3 text-lg leading-relaxed">{s.groupText}</p>
            <Link href={to("/estudo-em-grupo")} className="botao botao-papel mt-5">{s.groupCta}</Link>
          </section>
        </div>
      </div>
    </>
  );
}
