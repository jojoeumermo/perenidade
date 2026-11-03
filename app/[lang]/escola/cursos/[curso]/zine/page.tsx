// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { ReactNode } from "react";
import { BotaoImprimir } from "@/components/BotaoImprimir";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { textosDosCursos } from "@/i18n/escola/cursos";
import { carregarCursos, cursoPorSlug } from "@/lib/escola/cursos-servidor";
import { aulaDoSite, verCurso } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";
import { blocoDaAula, cortar, qrSvg, secoesDaAula } from "@/lib/zine";
import "@/styles/escola-cursos.css";

type Props = PageProps<"/[lang]/escola/cursos/[curso]/zine">;

// A zine do curso sai só em português (como o conteúdo das aulas): os outros idiomas redirecionam para ela.
export const dynamicParams = false;

export function generateStaticParams() {
  return carregarCursos().map((c) => ({ curso: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso) return {};
  const s = textosDosCursos("pt");
  return { ...paginaMeta(lang, `/escola/cursos/${curso.slug}/zine`, `${s.zine.olho}: ${curso.titulo}`, s.zine.lead), robots: { index: false, follow: true } };
}

/** Um quadro da folha (74 por 105 mm). Os quatro de cima saem de cabeça para baixo: é o que faz a dobra dar certo. */
function Quadro({ invertido, children, escuro = false }: { invertido?: boolean; children?: ReactNode; escuro?: boolean }) {
  return <div className={`livrinho-quadro flex flex-col overflow-hidden ${escuro ? "bg-[#1f1a14] text-[#f4ecd8]" : "bg-white text-[#17130e]"} ${invertido ? "rotate-180" : ""}`}>{children}</div>;
}

interface AulaDaZine {
  n: number;
  titulo: string;
  trilha: string;
  resumo: string;
  partes: string[];
  palavras: string[];
  pergunta: string;
  url: string;
  qr: string;
}

/**
 * A zine do curso: por módulo, folhas A4 deitadas que, dobradas e cortadas no meio como a zine da aula, viram livrinhos
 * de 8 páginas: a capa do módulo, seis aulas (o resumo, as partes, as palavras, a primeira pergunta e o QR de cada uma)
 * e a contracapa com o QR do curso. Só em português.
 */
export default async function ZineDoCurso({ params }: Props) {
  const { lang, t } = await loadLang(params);
  const curso = cursoPorSlug((await params).curso);
  if (!curso) notFound();
  if (lang !== "pt") permanentRedirect(localePath("pt", `/escola/cursos/${curso.slug}/zine`));
  const s = textosDosCursos("pt");
  const k = t.kit;
  const visto = verCurso(curso);
  const urlDoCurso = `${site.url}${localePath("pt", `/escola/cursos/${curso.slug}`)}`;
  const qrDoCurso = await qrSvg(urlDoCurso);

  // Em sequência (e não em paralelo), para a numeração "aula n de N" seguir a ordem do curso.
  let n = 0;
  const modulos: { titulo: string; folhas: AulaDaZine[][] }[] = [];
  for (const m of visto.modulos) {
    const aulas: AulaDaZine[] = [];
    for (const a of m.aulas) {
      n++;
      const lesson = aulaDoSite(a.id)?.lesson;
      const url = `${site.url}${localePath("pt", a.caminho)}`;
      aulas.push({
        n,
        titulo: a.titulo,
        trilha: a.trilha,
        resumo: a.resumo,
        partes: lesson ? secoesDaAula(lesson.body).map((p) => p.titulo).slice(0, 4) : [],
        palavras: (lesson?.terms ?? []).slice(0, 3).map((x) => x.term),
        pergunta: lesson?.quiz[0]?.question || (lesson ? blocoDaAula(lesson.body, "provocacao").join(" ") : ""),
        url,
        qr: await qrSvg(url),
      });
    }
    // Seis aulas por folha (as páginas 2 a 7 do livrinho).
    const folhas: AulaDaZine[][] = [];
    for (let i = 0; i < aulas.length; i += 6) folhas.push(aulas.slice(i, i + 6));
    modulos.push({ titulo: m.titulo, folhas });
  }

  const pagina = (p: number) => <p className="mt-auto pt-1 text-right font-mono text-[6.5pt] opacity-60">{p}</p>;
  const quadroDaAula = (a: AulaDaZine | undefined, p: number, invertido?: boolean) => (
    <Quadro invertido={invertido} key={`p${p}`}>
      {a ? (
        <div className="flex h-full flex-col p-[4mm]">
          <p className="font-mono text-[6pt] uppercase tracking-[0.14em] text-[#c21f16]">{fill(s.zine.aula, { n: a.n, total: visto.nAulas })}</p>
          <h3 className="mt-1 border-b-[1.5px] border-[#17130e] pb-1 font-serif text-[10.5pt] font-semibold leading-tight">{a.titulo}</h3>
          <p className="mt-1 font-serif text-[6.5pt] italic opacity-80">{a.trilha}</p>
          <p className="mt-1.5 font-serif text-[7.6pt] leading-[1.3]">{cortar(a.resumo, 230)}</p>
          {a.partes.length > 0 && (
            <p className="mt-1.5 font-serif text-[7pt] leading-snug">
              <b>{s.zine.partes}:</b> {cortar(a.partes.join(" · "), 150)}
            </p>
          )}
          {a.palavras.length > 0 && (
            <p className="mt-1 font-serif text-[7pt] leading-snug">
              <b>{s.zine.palavras}:</b> {a.palavras.join(", ")}
            </p>
          )}
          <div className="mt-auto flex items-end gap-[2mm] pt-1">
            {a.pergunta && (
              <p className="min-w-0 flex-1 font-serif text-[7pt] leading-snug">
                <b>{s.zine.pergunta}:</b> {cortar(a.pergunta, 150)}
              </p>
            )}
            <div className="h-[17mm] w-[17mm] shrink-0 bg-white p-[1mm]" role="img" aria-label={a.url} dangerouslySetInnerHTML={{ __html: a.qr }} />
          </div>
          {pagina(p)}
        </div>
      ) : (
        <div className="flex h-full flex-col p-[4mm]">{pagina(p)}</div>
      )}
    </Quadro>
  );

  return (
    <div className="zine-do-curso mx-auto max-w-6xl px-4 py-8">
      <div className="no-print">
        <Link href={localePath("pt", `/escola/cursos/${curso.slug}`)} className="font-sans text-sm text-ink-soft hover:text-oxblood">
          ← {s.zine.voltar}
        </Link>
        <p className="rotulo mt-6">{s.zine.olho}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight sm:text-5xl">{curso.titulo}</h1>
        <p className="mt-3 max-w-3xl text-lg text-ink-soft">{s.zine.lead}</p>
        <div className="mt-5 flex flex-wrap items-start gap-6">
          <BotaoImprimir texto={k.imprimir} />
          <div className="max-w-2xl font-sans text-sm">
            <p className="font-semibold">{k.zineComo}</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-soft">
              {k.zinePassos.map((passo) => (
                <li key={passo}>{passo}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {modulos.map((m, i) =>
        m.folhas.map((folha, f) => (
          <section key={`${i}-${f}`} className="zine-folha" aria-label={`${fill(s.zine.modulo, { n: i + 1 })} · ${fill(s.zine.folha, { n: f + 1, total: m.folhas.length })}`}>
            <p className="no-print mt-8 font-sans text-sm font-semibold">
              {fill(s.zine.modulo, { n: i + 1 })}: {m.titulo} · {fill(s.zine.folha, { n: f + 1, total: m.folhas.length })}
            </p>
            <div className="livrinho-moldura mt-2 overflow-x-auto">
              <div className="folha-livrinho" lang="pt">
                {/* Fileira de cima, de cabeça para baixo: páginas 5, 4, 3 e 2. */}
                {quadroDaAula(folha[3], 5, true)}
                {quadroDaAula(folha[2], 4, true)}
                {quadroDaAula(folha[1], 3, true)}
                {quadroDaAula(folha[0], 2, true)}
                {/* Fileira de baixo: páginas 6 e 7, a contracapa e a capa. */}
                {quadroDaAula(folha[4], 6)}
                {quadroDaAula(folha[5], 7)}
                <Quadro escuro>
                  <div className="flex h-full flex-col items-center justify-center p-[6mm] text-center">
                    <p className="font-serif text-[9pt]">{s.zine.curso}</p>
                    <div className="mt-3 h-[30mm] w-[30mm] bg-white p-[2mm]" role="img" aria-label={urlDoCurso} dangerouslySetInnerHTML={{ __html: qrDoCurso }} />
                    <p className="mt-2 break-all font-mono text-[6pt]">{urlDoCurso.replace(/^https?:\/\//, "")}</p>
                    <p className="mt-3 font-serif text-[9pt] font-semibold">{k.zinePasse}</p>
                    <p className="mt-2 font-serif text-[7pt] opacity-80">{k.zineLicenca}</p>
                  </div>
                </Quadro>
                <Quadro>
                  <div className="flex h-full flex-col p-[6mm]">
                    <div className="-mx-[6mm] -mt-[6mm] bg-[#1f1a14] px-[6mm] py-[3mm] font-mono text-[6.5pt] uppercase tracking-[0.2em] text-[#f4ecd8]">{s.catalogo.olho}</div>
                    <p className="mt-[7mm] font-mono text-[7pt] uppercase tracking-[0.18em] text-[#c21f16]">
                      {fill(s.zine.modulo, { n: i + 1 })} · {fill(s.zine.folha, { n: f + 1, total: m.folhas.length })}
                    </p>
                    <h2 className="mt-2 font-serif text-[17pt] font-semibold leading-[1.05]">{m.titulo}</h2>
                    <p className="mt-3 font-serif text-[9.5pt] italic">{curso.titulo}</p>
                    <div className="mt-auto flex items-center gap-2 border-t-[1.5px] border-[#17130e] pt-[3mm]">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a marca do instituto, impressa */}
                      <img src="/marca-192.png" alt="" width={36} height={36} className="h-[9mm] w-[9mm]" />
                      <span className="font-serif text-[11pt] font-semibold">{site.name}</span>
                    </div>
                  </div>
                </Quadro>
              </div>
            </div>
          </section>
        )),
      )}
    </div>
  );
}
