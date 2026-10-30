// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FaltamDias } from "@/components/enem/FaltamDias";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { TrackProgress } from "@/components/Progress";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { areaTools } from "@/lib/areas";
import { getTracks } from "@/lib/content";
import { formatarFato } from "@/lib/enem";
import { classificacoesDoEnem, edicaoDoEnem } from "@/lib/enem-conteudo";
import { lessonId } from "@/lib/ids";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/enem">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/enem", s.enem.titulo, s.enem.descricao);
}

/** Uma seção da porta: título, uma linha e o caminho (ou "em preparação" quando ainda não existe). */
function Secao({ titulo, texto, href, emBreve, children }: { titulo: string; texto: string; href?: string; emBreve: string; children?: React.ReactNode }) {
  return (
    <section className="border-2 border-ink bg-parchment-deep p-5 shadow-[4px_4px_0_var(--sombra)]">
      <h2 className="font-serif text-2xl font-semibold">{href ? <Link href={href} className="hover:text-oxblood">{titulo} →</Link> : titulo}</h2>
      <p className="mt-1 font-sans text-sm text-ink-soft">{texto}</p>
      {!href && <p className="mt-2 font-mono text-xs uppercase tracking-widest text-ink-soft">{emBreve}</p>}
      {children}
    </section>
  );
}

/**
 * A porta do curso ENEM (recurso "enem-curso"), na ordem da especificação: comece aqui, diagnóstico, plano, percurso por
 * área, prática, provas e simulados, redação, ferramentas, reta final e quanto falta para a prova (lido de
 * content/enem/edicao.yml). Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/enem">) {
  if (!ligado("enem-curso")) notFound();
  const { lang, t } = await loadLang(params);
  const { s: todos, traduzido } = textosDoEstudo(lang);
  const s = todos.enem;
  const to = (p: string) => localePath(lang, p);
  const edicao = edicaoDoEnem();
  const f = edicao.fatos;
  const trilhas = getTracks(lang)
    .filter((tr) => tr.area === "enem")
    .sort((a, b) => a.order - b.order);
  const trilha = (slug: string) => trilhas.find((tr) => tr.slug === slug && tr.lessons.length > 0);
  const temRota = { diagnostico: false, plano: false };
  const classificadas = classificacoesDoEnem().length;
  const ferramentas = areaTools.enem ?? [];
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={s.olho} title={s.titulo}>
        {s.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />

      <div className="mt-8 border-2 border-ink bg-folha p-5">
        <FaltamDias
          dia1={String(f["aplicacao-dia-1"].valor)}
          dia2={String(f["aplicacao-dia-2"].valor)}
          d={{ d1: formatarFato(f["aplicacao-dia-1"]), d2: formatarFato(f["aplicacao-dia-2"]), ano: edicao.edicao, gabarito: formatarFato(f["gabarito-prazo"]) }}
          s={s}
        />
        <p className="mt-1 font-sans text-sm">{fill(s.datasProva, { d1: formatarFato(f["aplicacao-dia-1"]), d2: formatarFato(f["aplicacao-dia-2"]) })}</p>
        <p className="mt-1 font-sans text-xs text-ink-soft">
          <a href={edicao.fontes[f["aplicacao-dia-1"].fonte].url} className="underline hover:text-oxblood" rel="noopener noreferrer">
            {fill(s.fonteDatas, { data: edicao.conferido.split("-").reverse().join("/") })}
          </a>
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Secao titulo={s.secoes.comece} texto={s.secoes.comeceTexto} href={trilha("enem-como-funciona") ? to("/trilhas/enem-como-funciona") : undefined} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.diagnostico} texto={s.secoes.diagnosticoTexto} href={temRota.diagnostico ? to("/enem/diagnostico") : undefined} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.plano} texto={s.secoes.planoTexto} href={temRota.plano ? to("/enem/plano") : undefined} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.praticar} texto={s.secoes.praticarTexto} href={classificadas ? to("/enem/praticar") : undefined} emBreve={s.emBreve}>
          {classificadas > 0 && <p className="mt-2 font-mono text-xs">{fill(s.classificadas, { n: classificadas })}</p>}
        </Secao>
        <Secao titulo={s.secoes.provas} texto={s.secoes.provasTexto} href={to("/enem/provas")} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.redacao} texto={s.secoes.redacaoTexto} href={trilha("enem-redacao") ? to("/trilhas/enem-redacao") : undefined} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.retaFinal} texto={s.secoes.retaFinalTexto} href={trilha("enem-reta-final") ? to("/trilhas/enem-reta-final") : undefined} emBreve={s.emBreve} />
        <Secao titulo={s.secoes.diaDaProva} texto={s.secoes.diaDaProvaTexto} href={to("/enem/dia-da-prova")} emBreve={s.emBreve} />
      </div>

      <h2 className="tarja mt-12">
        <span className="tarja-nome">{s.secoes.percurso}</span>
      </h2>
      <p className="mt-2 font-sans text-sm text-ink-soft">{s.secoes.percursoTexto}</p>
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {trilhas.map((tr) => {
          const prontas = tr.plan.filter((p) => p.ready);
          return (
            <li key={tr.slug} className="border border-rule bg-parchment-deep p-4">
              <Link href={to(`/trilhas/${tr.slug}`)} className="font-serif text-xl font-semibold hover:text-oxblood">{tr.title}</Link>
              <p className="mt-1 font-sans text-sm text-ink-soft">{tr.summary}</p>
              <p className="mt-2 font-mono text-xs">{fill(s.aulasProntas, { a: prontas.length, b: tr.plan.length })}</p>
              {prontas.length > 0 && (
                <div className="mt-2">
                  <TrackProgress ids={prontas.map((p) => lessonId(tr.slug, p.slug))} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <h2 className="tarja mt-12">
        <span className="tarja-nome">{s.secoes.ferramentas}</span>
      </h2>
      <p className="mt-2 font-sans text-sm text-ink-soft">{s.secoes.ferramentasTexto}</p>
      <ul className="mt-4 flex flex-wrap gap-3 font-sans text-sm">
        {ferramentas.map((id) => {
          const nome = (t.toolNames as Record<string, string[] | undefined>)[id]?.[0] ?? id;
          return (
            <li key={id}>
              <Link href={to(`/ferramentas/${id}`)} className="inline-block border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{nome}</Link>
            </li>
          );
        })}
        <li>
          <Link href={to("/laboratorios/simulacoes")} className="inline-block border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{t.labs.simulacoes}</Link>
        </li>
      </ul>
    </div>
  );
}
