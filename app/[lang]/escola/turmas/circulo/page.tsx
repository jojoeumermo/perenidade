// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CirculoDeCultura } from "@/components/escola/turma/CirculoDeCultura";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaTurma } from "@/i18n/escola/turma";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-turma.css";

/** O endereço do artigo de referência, aberto e conferido antes de citar (docs/escola/turma.md). */
const FONTE = "https://periodicos.ufes.br/prodiscente/article/view/18600/12608";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/escola/turmas/circulo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  return paginaMeta(
    lang,
    "/escola/turmas/circulo",
    `${s.meta.circulo.titulo} · ${textosDaBase(lang).meta.titulo}`,
    s.meta.circulo.descricao,
  );
}

/** Círculo de cultura digital (E4-15, D1-18): a ferramenta de quem facilita, toda no aparelho. Página igual para todos. */
export default async function Page({
  params,
}: PageProps<"/[lang]/escola/turmas/circulo">) {
  const { lang } = await loadLang(params);
  const s = textosDaTurma(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-circulo="">
      <PageHeading
        eyebrow={s.circulo.olho}
        title={s.circulo.titulo}
        voltar={{
          href: localePath(lang, "/escola/turmas"),
          texto: s.curso.voltar,
        }}
      >
        {s.circulo.lead}
      </PageHeading>
      <p className="turma-fonte">
        <span className="font-semibold">{s.circulo.fonte}</span>{" "}
        <span lang="pt">{s.circulo.fonteTexto}</span>{" "}
        <a
          href={FONTE}
          target="_blank"
          rel="noreferrer"
          className="break-all underline hover:text-oxblood"
        >
          {FONTE}
        </a>
        <span className="mt-1 block">{s.circulo.fonteNota}</span>
      </p>
      <CirculoDeCultura s={s.circulo} lang={lang} />
    </div>
  );
}
