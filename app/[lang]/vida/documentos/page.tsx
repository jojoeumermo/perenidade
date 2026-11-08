// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaVida } from "@/i18n/escola/vida";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import dados from "@/content/escola/vida/documentos.json";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/vida/documentos", `${s.meta.documentos.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.documentos.descricao);
}

/** Explica o bloco "documento" das aulas, as regras de fonte e de privacidade e lista as aulas que o usam. */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const aulas = dados.aulas as { aula: string; titulo: string }[];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-vida="documentos">
      <PageHeading eyebrow={s.documentos.olho} title={s.documentos.titulo} voltar={{ href: localePath(lang, "/vida"), texto: s.comum.voltarVida }}>
        {s.documentos.lead}
      </PageHeading>
      <section className="vida-bloco">
        <h2 className="vida-titulo">{s.documentos.regrasTitulo}</h2>
        <ul className="vida-lista">
          {s.documentos.regras.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>
      <section className="vida-bloco">
        <h2 className="vida-titulo">{s.documentos.listaTitulo}</h2>
        {aulas.length === 0 ? (
          <p className="vida-aviso" data-documentos-vazio="">
            {s.documentos.vazio}
          </p>
        ) : (
          <ul className="vida-lista">
            {aulas.map((a) => (
              <li key={a.aula}>
                <p className="font-semibold" lang="pt">
                  {a.titulo}
                </p>
                <Link href={localePath(lang, `/trilhas/${a.aula}`)} className="underline hover:text-oxblood">
                  {s.documentos.abrirAula}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="vida-bloco">
        <h2 className="vida-titulo">{s.documentos.comoTitulo}</h2>
        <p className="vida-texto">{s.documentos.como}</p>
      </section>
    </div>
  );
}