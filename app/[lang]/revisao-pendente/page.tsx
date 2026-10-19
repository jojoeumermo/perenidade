// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { lerPendencias } from "@/lib/pendencias";

export const metadata: Metadata = { title: "Pendências de revisão", robots: { index: false, follow: false } };

const NOMES: Record<string, string> = { objetivo: "objetivo", explicacao: "explicação", exemplo: "exemplo resolvido", exercicio: "exercício", resumo: "resumo", fontes: "fontes" };

/**
 * Painel simples de pendências, só no ambiente de desenvolvimento (npm run dev): o que espera revisão e o que falta
 * a cada aula para seguir o modelo. No site publicado esta página não existe. O mesmo relatório sai em `npm run pendencias`.
 */
export default async function Page({ params }: PageProps<"/[lang]/revisao-pendente">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { lang } = await loadLang(params);
  const { aulas, exercicios, exerciciosEmRevisao, erros } = lerPendencias();
  const trilhas = [...new Set(aulas.map((a) => a.trilha))];
  const conta = (f: (a: (typeof aulas)[number]) => boolean) => aulas.filter(f).length;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 font-sans text-sm">
      <PageHeading eyebrow="Só em desenvolvimento" title="Pendências de revisão">
        O que espera revisão e o que falta para cada aula seguir o modelo (docs/MODELO-DE-AULA.md). Para revisar, siga docs/CHECKLIST-DE-REVISAO.md.
      </PageHeading>
      {erros.length > 0 && (
        <section className="mt-6 border-2 border-oxblood p-4">
          <h2 className="font-semibold text-oxblood">Erros de formato</h2>
          <ul className="mt-2 list-disc pl-5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </section>
      )}
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        <li>Aulas: {aulas.length}</li>
        <li>Revisadas com histórico: {conta((a) => a.situacao === "revisada")}</li>
        <li>Aprovadas no painel: {conta((a) => a.situacao === "aprovada")}</li>
        <li>Em revisão: {conta((a) => a.situacao === "em-revisao")}</li>
        <li>Seguem o modelo inteiro: {conta((a) => a.faltam.length === 0)}</li>
        <li>
          Exercícios com explicação: {exercicios} ({exerciciosEmRevisao} em revisão)
        </li>
      </ul>
      <div className="mt-8 space-y-2">
        {trilhas.map((trilha) => {
          const lista = aulas.filter((a) => a.trilha === trilha);
          const pendentes = lista.filter((a) => a.situacao === "em-revisao").length;
          return (
            <details key={trilha} className="border border-rule bg-parchment-deep p-3">
              <summary className="cursor-pointer">
                <strong>{trilha}</strong> · {lista.length} aulas · {pendentes} em revisão · {lista.filter((a) => a.faltam.length === 0).length} no modelo
              </summary>
              <table className="mt-3 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="py-1 pr-2">Aula</th>
                    <th className="py-1 pr-2">Situação</th>
                    <th className="py-1 pr-2">Falta no modelo</th>
                    <th className="py-1">Exercícios</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((a) => (
                    <tr key={a.aula} className="border-b border-rule align-top">
                      <td className="py-1 pr-2">
                        <Link href={localePath(lang, `/trilhas/${a.trilha}/${a.aula}`)} className="underline hover:text-oxblood">
                          {a.titulo}
                        </Link>
                      </td>
                      <td className="py-1 pr-2">{a.situacao === "revisada" ? `revisada (${a.revisoes[0].funcao}, ${a.revisoes[0].data})` : a.situacao === "aprovada" ? "aprovada no painel" : "em revisão"}</td>
                      <td className="py-1 pr-2">{a.faltam.map((p) => NOMES[p]).join(", ") || "—"}</td>
                      <td className="py-1">{a.exercicios ? `${a.exercicios} (${a.exerciciosEmRevisao} em revisão)` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </div>
    </div>
  );
}
