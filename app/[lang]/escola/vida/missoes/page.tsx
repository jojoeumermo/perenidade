// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { MissaoDoLab } from "@/components/escola/vida/MissaoDoLab";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaVida } from "@/i18n/escola/vida";
import { carregarCursos } from "@/lib/escola/cursos-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import type { Missao } from "@/lib/escola/vida";
import { paginaMeta } from "@/lib/seo";
import dados from "@/content/escola/vida/missoes.json";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/escola/vida/missoes", `${s.meta.missoes.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.missoes.descricao);
}

/** As missões curadas, agrupadas por curso. A marca "cumpri" é da própria pessoa e fica só neste aparelho. */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  const cursos = Object.fromEntries(carregarCursos().map((c) => [c.slug, c.titulo]));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-vida="missoes">
      <PageHeading eyebrow={s.missoes.olho} title={s.missoes.titulo} voltar={{ href: localePath(lang, "/escola/vida"), texto: s.comum.voltarVida }}>
        {s.missoes.lead}
      </PageHeading>
      <p className="vida-nota">{s.missoes.emRevisao}</p>
      <MissaoDoLab missoes={dados.missoes as Missao[]} cursos={cursos} s={s.missoes} selo={s.comum.emRevisao} lang={lang} />
    </div>
  );
}