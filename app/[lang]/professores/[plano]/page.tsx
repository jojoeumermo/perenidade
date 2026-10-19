// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListaDeHabilidades } from "@/components/estudo/Habilidades";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { getTrack } from "@/lib/content";
import { mapaDaAula, planosDeAula } from "@/lib/curriculo-conteudo";
import type { MapaDaAula } from "@/lib/mapa-curricular";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

type Props = PageProps<"/[lang]/professores/[plano]">;

export const dynamicParams = false;

// Desligado o recurso, nenhum plano é gerado: todo endereço daqui responde "não encontrado".
export function generateStaticParams() {
  return ligado("professores") ? planosDeAula().map((p) => ({ plano: p.slug })) : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { plano: slug } = await params;
  const plano = planosDeAula().find((p) => p.slug === slug);
  return plano ? paginaMeta(lang, `/professores/${plano.slug}`, plano.titulo, plano.resumo) : {};
}

/** Um plano de aula para professores, com as aulas do site que ele usa e as habilidades ligadas a elas. */
export default async function Page({ params }: Props) {
  if (!ligado("professores")) notFound();
  const { lang, t } = await loadLang(params);
  const { plano: slug } = await params;
  const plano = planosDeAula().find((p) => p.slug === slug);
  if (!plano) notFound();
  const { s } = textosDoEstudo(lang);
  const trilha = getTrack(plano.trilha, lang);
  const aulas = plano.aulas.map((a) => ({ slug: a, titulo: trilha?.lessons.find((l) => l.slug === a)?.title ?? a }));
  // As habilidades das aulas do plano, juntas e sem repetir.
  const mapa: MapaDaAula = { bncc: [], enem: [] };
  if (ligado("mapa-curricular"))
    for (const a of plano.aulas) {
      const m = mapaDaAula(plano.trilha, a);
      for (const h of m?.bncc ?? []) if (!mapa.bncc.some((x) => x.codigo === h.codigo)) mapa.bncc.push(h);
      for (const h of m?.enem ?? []) if (!mapa.enem.some((x) => x.area === h.area && x.habilidade === h.habilidade)) mapa.enem.push(h);
    }
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="no-print font-sans text-sm">
        <Link href={localePath(lang, "/professores")} className="text-ink-soft hover:text-oxblood">
          ← {s.professores.olho}
        </Link>
      </p>
      <PageHeading eyebrow={s.professores.plano} title={plano.titulo}>
        {plano.resumo}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div className="mt-6 grid gap-4 border border-rule bg-parchment-deep p-4 font-sans text-sm sm:grid-cols-2" lang="pt-BR">
        <p>
          <strong>{s.professores.duracao}:</strong> {plano.duracao}
        </p>
        <p>
          <strong>{s.professores.publico}:</strong> {plano.publico}
        </p>
        <div className="sm:col-span-2">
          <strong>{s.professores.aulasDoSite}:</strong>
          <ol className="mt-1 list-decimal pl-5">
            {aulas.map((a) => (
              <li key={a.slug}>
                <Link href={localePath(lang, `/trilhas/${plano.trilha}/${a.slug}`)} className="underline hover:text-oxblood">
                  {a.titulo}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {(mapa.bncc.length > 0 || mapa.enem.length > 0) && (
        <section aria-labelledby="hab" className="mt-6 border border-rule p-4">
          <h2 id="hab" className="font-sans text-sm font-semibold">
            {s.mapa.doPlano}
          </h2>
          <div className="mt-2">
            <ListaDeHabilidades mapa={mapa} s={s.mapa} />
          </div>
        </section>
      )}
      <div className="mt-8" lang="pt-BR">
        <Markdown lang={lang}>{plano.corpo}</Markdown>
      </div>
      <p className="mt-10 font-mono text-xs text-ink-soft">{s.professores.licenca}</p>
    </div>
  );
}
