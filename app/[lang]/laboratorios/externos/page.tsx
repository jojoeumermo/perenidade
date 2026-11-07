// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { LabsExternos, NotaDosLabsExternos, type ExtraDoLab } from "@/components/labs/LabsExternos";
import { aulasDoLab } from "@/components/labs/MapaDosLaboratorios";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { FINALIDADES, labsDaFinalidade, MAPA_DOS_LABORATORIOS, textosDoLab } from "@/lib/mapa-dos-laboratorios";
import { paginaMeta } from "@/lib/seo";

const TITULO: Record<string, string> = { pt: "Laboratórios abertos de fora", en: "Open labs from elsewhere" };
const LEAD: Record<string, string> = {
  pt: "Simuladores, explorables e ferramentas feitos por outras pessoas e instituições, com licença livre ou aberta, sempre com crédito. Nada carrega antes de você abrir, e o nosso site não rastreia você (os de fora, depois de abertos, seguem as regras de quem os mantém).",
  en: "Simulators, explorables and tools made by other people and institutions, under free or open licences, always credited. Nothing loads before you open it, and our site does not track you (outside labs, once open, follow their own maintainers' rules).",
};

export async function generateMetadata({ params }: PageProps<"/[lang]/laboratorios/externos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return paginaMeta(lang, "/laboratorios/externos", TITULO[lang] ?? TITULO.en, LEAD[lang] ?? LEAD.en);
}

/**
 * Os laboratórios de fora, agora organizados pela finalidade (NOVAS TAREFAS, T21): cada grupo diz para que serve, e cada
 * cartão diz para quem é, em que disciplinas e aulas ajuda (o mapa fica em lib/mapa-dos-laboratorios.ts). Nenhum saiu:
 * o catálogo inteiro aparece, e o teste do mapa confere que todo item do catálogo tem lugar num grupo.
 */
export default async function Page({ params }: PageProps<"/[lang]/laboratorios/externos">) {
  const { lang, t } = await loadLang(params);
  const m = t.labs.mapa;
  const rotulos = { serve: m.serve, quem: m.quem, ajudaEm: m.ajudaEm, aulas: m.aulas };
  const extras: Record<string, ExtraDoLab> = Object.fromEntries(
    MAPA_DOS_LABORATORIOS.filter((l) => l.morada === "fora").map((l) => {
      const tx = textosDoLab(l, lang);
      return [
        l.id,
        {
          serve: tx.serve,
          quem: tx.quem,
          rotulos,
          disciplinas: l.disciplinas.map((a) => ({ nome: t.areas[a][0], href: localePath(lang, `/estantes/${a}`) })),
          aulas: aulasDoLab(l, lang),
        },
      ];
    }),
  );
  const grupos = FINALIDADES.map((f) => ({ f, ids: labsDaFinalidade(f).filter((l) => l.morada === "fora").map((l) => l.id) })).filter((g) => g.ids.length > 0);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <PageHeading eyebrow={t.labs.title} title={TITULO[lang] ?? TITULO.en} voltar={{ href: localePath(lang, "/laboratorios"), texto: m.todos }}>
        {LEAD[lang] ?? LEAD.en}
      </PageHeading>
      <nav aria-label={m.porFinalidade} className="no-print font-sans text-sm">
        <ul className="flex flex-wrap gap-2">
          {grupos.map(({ f }) => (
            <li key={f}>
              <a href={`#${f}`} className="inline-block border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood">{m.finalidades[f].titulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      {grupos.map(({ f, ids }) => {
        const ehGrafico = ids.includes("owid-expectativa-vida");
        return (
          <section key={f} id={f} aria-labelledby={`titulo-${f}`} className="mt-12 scroll-mt-24">
            <h2 id={`titulo-${f}`} className="border-b-2 border-ink pb-2 font-serif text-2xl font-semibold">{m.finalidades[f].titulo}</h2>
            <p className="mt-2 font-sans text-sm text-ink-soft">
              {m.finalidades[f].serve}{" "}
              <Link href={`${localePath(lang, "/laboratorios")}#${f}`} className="underline underline-offset-4 hover:text-oxblood">{m.todos} →</Link>
            </p>
            <LabsExternos ids={ids.filter((id) => id !== "owid-expectativa-vida")} extras={extras} grafico={ehGrafico} nota={false} />
          </section>
        );
      })}
      <NotaDosLabsExternos />
    </div>
  );
}
