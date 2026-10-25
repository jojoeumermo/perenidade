// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { blocoDaAula, cortar, qrSvg, secoesDaAula } from "@/lib/zine";

type Props = PageProps<"/[lang]/trilhas/[track]/[lesson]/zine">;

// Montada na primeira visita e guardada (um dia), em vez de na montagem do site: são milhares de folhas que quase
// ninguém abre ao mesmo tempo, e montá-las todas de uma vez estouraria o tempo de montagem.
export const revalidate = 86400;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const lesson = track?.lessons.find((l) => l.slug === lessonSlug);
  return track && lesson ? { ...paginaMeta(lang, `/trilhas/${track.slug}/${lesson.slug}/zine`, `${t.kit.zineTitulo}: ${lesson.title}`, t.kit.zineLead), robots: { index: false } } : {};
}

/** Um quadro da folha (74 por 105 mm). Os quatro de cima saem de cabeça para baixo: é o que faz a dobra dar certo. */
function Quadro({ invertido, children, escuro = false }: { invertido?: boolean; children: ReactNode; escuro?: boolean }) {
  return <div className={`livrinho-quadro flex flex-col overflow-hidden ${escuro ? "bg-[#1f1a14] text-[#f4ecd8]" : "bg-white text-[#17130e]"} ${invertido ? "rotate-180" : ""}`}>{children}</div>;
}

const Estrela = ({ className = "" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden className={className}>
    <path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z" fill="currentColor" />
  </svg>
);

/**
 * A zine da aula: uma folha A4 deitada que, dobrada e cortada no meio, vira um livrinho de 8 páginas. Para quem não tem
 * internet: o resumo, a pergunta, o começo de cada parte, as palavras e o QR para a aula completa.
 */
export default async function ZineDaAula({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const { track: trackSlug, lesson: lessonSlug } = await params;
  const track = getTrack(trackSlug, lang);
  const index = track?.lessons.findIndex((l) => l.slug === lessonSlug) ?? -1;
  if (!track || index < 0) notFound();
  const lesson = track.lessons[index];
  const s = t.kit;
  const caminho = localePath(lang, `/trilhas/${track.slug}/${lesson.slug}`);
  const url = `${site.url}${caminho}`;
  const qr = await qrSvg(url);

  const pergunta = blocoDaAula(lesson.body, "provocacao").join(" ") || lesson.summary;
  const roda = [...blocoDaAula(lesson.body, "roda"), ...lesson.quiz.map((q) => q.question)].slice(0, 3);
  const secoes = secoesDaAula(lesson.body).slice(0, 4);
  // Com menos de quatro partes, as palavras da aula ocupam o espaço que sobrou.
  const miolo: { titulo: string; texto: string }[] = [...secoes];
  const termos = lesson.terms.slice(0, 4);
  if (miolo.length < 4 && termos.length) miolo.push({ titulo: s.zinePalavras, texto: termos.map((x) => `${x.term}: ${x.summary}`).join(" · ") });
  while (miolo.length < 4) miolo.push({ titulo: "", texto: "" });

  const pagina = (n: number) => <p className="mt-auto pt-2 text-right font-mono text-[7pt] opacity-60">{n}</p>;
  const parte = (p: { titulo: string; texto: string }, n: number, invertido?: boolean) => (
    <Quadro invertido={invertido}>
      <div className="flex h-full flex-col p-[5mm]">
        {p.titulo && <h2 className="border-b-2 border-[#17130e] pb-1 font-serif text-[12pt] font-semibold leading-tight">{p.titulo}</h2>}
        <p className="mt-2 font-serif text-[9.2pt] leading-[1.35]">{cortar(p.texto, 560)}</p>
        {pagina(n)}
      </div>
    </Quadro>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="no-print">
        <Link href={caminho} className="font-sans text-sm text-ink-soft hover:text-oxblood">← {s.voltarAula}</Link>
        <p className="rotulo mt-6">{s.zineTitulo}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">{lesson.title}</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">{s.zineLead}</p>
        <div className="mt-5 flex flex-wrap items-start gap-6">
          <BotaoImprimir texto={s.imprimir} />
          <div className="max-w-2xl font-sans text-sm">
            <p className="font-semibold">{s.zineComo}</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-soft">
              {s.zinePassos.map((passo) => <li key={passo}>{passo}</li>)}
            </ol>
          </div>
        </div>
      </div>

      <div className="livrinho-moldura mt-8 overflow-x-auto">
        <div className="folha-livrinho" lang={lang}>
          {/* Fileira de cima, de cabeça para baixo: páginas 5, 4, 3 e 2. */}
          {parte(miolo[2], 5, true)}
          {parte(miolo[1], 4, true)}
          {parte(miolo[0], 3, true)}
          <Quadro invertido>
            <div className="flex h-full flex-col p-[5mm]">
              <p className="font-mono text-[7pt] uppercase tracking-[0.18em] text-[#c21f16]">{s.zinePergunta}</p>
              <p className="mt-3 font-serif text-[13pt] font-semibold leading-snug">{cortar(pergunta, 300)}</p>
              <p className="mt-3 font-serif text-[9.2pt] italic leading-snug">{cortar(lesson.summary, 260)}</p>
              {pagina(2)}
            </div>
          </Quadro>
          {/* Fileira de baixo: páginas 6 e 7, a contracapa e a capa. */}
          {parte(miolo[3], 6)}
          <Quadro>
            <div className="flex h-full flex-col p-[5mm]">
              <h2 className="border-b-2 border-[#17130e] pb-1 font-serif text-[12pt] font-semibold leading-tight">{s.zinePensar}</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 font-serif text-[9.2pt] leading-snug">
                {roda.map((q) => <li key={q}>{cortar(q, 180)}</li>)}
              </ol>
              {termos.length > 0 && secoes.length >= 4 && (
                <p className="mt-3 font-serif text-[8.5pt] leading-snug">
                  <b>{s.zinePalavras}:</b> {termos.slice(0, 3).map((x) => x.term).join(", ")}
                </p>
              )}
              {pagina(7)}
            </div>
          </Quadro>
          <Quadro escuro>
            <div className="flex h-full flex-col items-center justify-center p-[6mm] text-center">
              <p className="font-serif text-[9pt]">{s.zineLeia}</p>
              <div className="mt-3 h-[34mm] w-[34mm] bg-white p-[2mm]" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-2 break-all font-mono text-[6.5pt]">{url.replace(/^https?:\/\//, "")}</p>
              <p className="mt-3 font-mono text-[8pt] text-[#e0837a]">@{site.instagramUser}</p>
              <p className="mt-3 font-serif text-[9pt] font-semibold">{s.zinePasse}</p>
              <p className="mt-2 font-serif text-[7pt] opacity-80">{s.zineLicenca}</p>
            </div>
          </Quadro>
          <Quadro>
            <div className="flex h-full flex-col p-[6mm]">
              <div className="-mx-[6mm] -mt-[6mm] flex items-center gap-2 bg-[#1f1a14] px-[6mm] py-[3mm] text-[#f4ecd8]">
                <Estrela className="h-[4mm] w-[4mm] text-[#c21f16]" />
                <span className="font-mono text-[6.5pt] uppercase tracking-[0.2em]">{s.zineRotulo}</span>
              </div>
              <p className="mt-[8mm] font-mono text-[7pt] uppercase tracking-[0.18em] text-[#c21f16]">
                {t.areas[track.area][0]} · {fill(s.zineAula, { i: index + 1, n: track.lessons.length })}
              </p>
              <h1 className="mt-2 font-serif text-[20pt] font-semibold leading-[1.05]">{lesson.title}</h1>
              <p className="mt-3 font-serif text-[9.5pt] italic">{track.title}</p>
              <div className="mt-auto flex items-center gap-2 border-t-[1.5px] border-[#17130e] pt-[3mm]">
                {/* eslint-disable-next-line @next/next/no-img-element -- a marca do instituto, impressa */}
                <img src="/marca-192.png" alt="" width={36} height={36} className="h-[9mm] w-[9mm]" />
                <span className="font-serif text-[11pt] font-semibold">{site.name}</span>
              </div>
            </div>
          </Quadro>
        </div>
      </div>
    </div>
  );
}
