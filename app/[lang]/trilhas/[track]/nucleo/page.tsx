// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { blocoDaAula, cortar, qrSvg } from "@/lib/zine";

type Props = PageProps<"/[lang]/trilhas/[track]/nucleo">;

// Montada na primeira visita e guardada (um dia), em vez de na montagem do site: são milhares de folhas que quase
// ninguém abre ao mesmo tempo, e montá-las todas de uma vez estouraria o tempo de montagem.
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  return track ? paginaMeta(lang, `/trilhas/${track.slug}/nucleo`, `${t.kit.kitTitulo}: ${track.title}`, t.kit.kitLead) : {};
}

const folha = "folha-do-kit border-2 border-ink bg-white p-8 text-[#17130e] max-md:p-5";

/**
 * O kit para estudar uma trilha em grupo (no bairro, na ocupação, no sindicato, na escola): o cartaz de chamada com QR
 * e o @, o guia de quem media, o roteiro de 1 hora para cada aula e a lista de presença. Cada parte sai numa folha A4.
 */
export default async function KitDoNucleo({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const track = getTrack((await params).track, lang);
  if (!track) notFound();
  const s = t.kit;
  const caminho = localePath(lang, `/trilhas/${track.slug}`);
  const url = `${site.url}${caminho}`;
  const qr = await qrSvg(url);
  const aulas = track.lessons.filter((lesson) => lesson.body.trim());
  const linha = "mt-1 block h-8 border-b border-[#17130e]";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="no-print">
        <Link href={caminho} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {s.voltarTrilha}</Link>
        <p className="rotulo mt-6">{s.kitTitulo}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">{track.title}</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">{s.kitLead}</p>
        <div className="mt-5">
          <BotaoImprimir texto={s.imprimir} />
        </div>
      </div>

      <div className="kit-do-nucleo mt-8 space-y-8" lang={lang}>
        {/* 1. O cartaz de chamada: preencher à mão o dia, o lugar e o contato do núcleo (nunca o de uma pessoa). */}
        <section className={`${folha} flex min-h-[260mm] flex-col max-md:min-h-0`}>
          <div className="-mx-8 -mt-8 flex items-center justify-between bg-[#1f1a14] px-8 py-4 text-[#f4ecd8] max-md:-mx-5 max-md:-mt-5 max-md:px-5">
            <span className="font-mono text-sm uppercase tracking-[0.2em]">★ {s.cartazTitulo}</span>
            <span className="font-mono text-sm text-[#e0837a]">@{site.instagramUser}</span>
          </div>
          <p className="mt-10 font-mono text-sm uppercase tracking-[0.2em] text-[#c21f16]">{t.areas[track.area][0]}</p>
          <h2 className="mt-3 font-serif text-6xl font-semibold leading-[1.02] max-md:text-4xl">{track.title}</h2>
          <p className="mt-6 max-w-xl font-serif text-2xl leading-snug">{s.cartazConvite}</p>
          <div className="mt-10 grid gap-6 font-sans text-xl">
            {[s.cartazQuando, s.cartazOnde, s.cartazContato].map((rotulo) => (
              <p key={rotulo}>
                <b>{rotulo}</b>
                <span className={linha} />
              </p>
            ))}
          </div>
          <div className="mt-auto flex items-end justify-between gap-6 border-t-[3px] border-[#17130e] pt-6">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a marca do instituto, impressa */}
              <img src="/marca-192.png" alt="" width={56} height={56} className="h-14 w-14" />
              <span className="font-serif text-2xl font-semibold">{site.name}</span>
            </div>
            <div className="text-center">
              <div className="h-32 w-32" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-1 max-w-[9rem] font-sans text-xs">{s.cartazQr}</p>
            </div>
          </div>
        </section>

        {/* 2. O guia de quem media. */}
        <section className={folha}>
          <h2 className="border-b-[3px] border-[#17130e] pb-2 font-serif text-3xl font-semibold">{s.guiaTitulo}</h2>
          <ol className="mt-5 list-decimal space-y-3 pl-6 font-serif text-lg leading-relaxed">
            {s.guia.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </section>

        {/* 3. Um roteiro de 1 hora para cada aula pronta. */}
        <section className={folha}>
          <h2 className="border-b-[3px] border-[#17130e] pb-2 font-serif text-3xl font-semibold">{s.roteiroTitulo}</h2>
          <p className="mt-3 font-sans text-sm">{s.roteiroLead}</p>
          {aulas.length === 0 && <p className="mt-6 font-serif text-lg">{s.semAulas}</p>}
          {aulas.map((lesson, i) => {
            const pergunta = blocoDaAula(lesson.body, "provocacao").join(" ") || lesson.summary;
            const roda = [...blocoDaAula(lesson.body, "roda"), ...lesson.quiz.map((q) => q.question)].slice(0, 3);
            const tarefa = blocoDaAula(lesson.body, "leve");
            const aula = `${site.url}${localePath(lang, `/trilhas/${track.slug}/${lesson.slug}`)}`;
            const etapas: [string, number, React.ReactNode][] = [
              [s.abertura, 10, <div key="abertura"><p className="text-sm">{s.aberturaTexto}</p><p className="mt-1 font-semibold">{cortar(pergunta, 280)}</p></div>],
              [s.leitura, 15, <div key="leitura"><p className="text-sm">{s.leituraTexto}</p><p className="mt-1 break-all font-mono text-xs">{aula.replace(/^https?:\/\//, "")}</p></div>],
              [s.roda, 20, <ol key="roda" className="list-decimal space-y-1 pl-5">{roda.map((q) => <li key={q}>{cortar(q, 200)}</li>)}</ol>],
              [s.tarefa, 10, tarefa.length ? <ul key="tarefa" className="list-disc space-y-1 pl-5">{tarefa.slice(0, 3).map((x) => <li key={x}>{cortar(x, 200)}</li>)}</ul> : <p key="tarefa">{s.tarefaPadrao}</p>],
              [s.fechamento, 5, <p key="fechamento">{s.fechamentoTexto}</p>],
            ];
            return (
              <article key={lesson.slug} className="mt-8 break-inside-avoid border-t-2 border-[#17130e] pt-4">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#c21f16]">{fill(s.encontro, { i: i + 1 })}</p>
                <h3 className="mt-1 font-serif text-2xl font-semibold leading-tight">{lesson.title}</h3>
                <dl className="mt-3 grid gap-3 font-serif text-[1.05rem] leading-snug">
                  {etapas.map(([nome, minutos, conteudo]) => (
                    <div key={nome} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 max-md:grid-cols-1">
                      <dt className="font-sans text-sm font-semibold">
                        {nome}
                        <span className="block font-mono text-xs font-normal text-[#8a5a16]">{fill(s.minutos, { n: minutos })}</span>
                      </dt>
                      <dd className="min-w-0">{conteudo}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </section>

        {/* 4. A lista de presença: só nome ou apelido, uma coluna por encontro. */}
        <section className={folha}>
          <h2 className="border-b-[3px] border-[#17130e] pb-2 font-serif text-3xl font-semibold">{s.presencaTitulo}</h2>
          <p className="mt-3 border-l-4 border-[#c21f16] pl-3 font-sans text-sm">{s.presencaAviso}</p>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full border-collapse font-sans text-sm">
              <thead>
                <tr>
                  <th className="border border-[#17130e] px-2 py-1 text-left">{s.presencaNome}</th>
                  {Array.from({ length: Math.max(4, Math.min(aulas.length, 10)) }, (_, i) => (
                    <th key={i} className="w-9 border border-[#17130e] px-1 py-1 text-center font-mono">{i + 1}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 18 }, (_, linhaN) => (
                  <tr key={linhaN}>
                    <td className="h-9 border border-[#17130e]" />
                    {Array.from({ length: Math.max(4, Math.min(aulas.length, 10)) }, (_, i) => <td key={i} className="border border-[#17130e]" />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
