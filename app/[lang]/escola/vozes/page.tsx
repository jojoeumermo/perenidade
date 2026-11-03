// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { GravadorDeVoz } from "@/components/escola/vida/GravadorDeVoz";
import { ListaDeVozes } from "@/components/escola/vida/ListaDeVozes";
import { TrabalhadoresQueEnsinam } from "@/components/escola/vida/TrabalhadoresQueEnsinam";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDaVida } from "@/i18n/escola/vida";
import { textosDaBase } from "@/lib/escola/textos";
import type { TrabalhadorQueEnsina, VozPublica } from "@/lib/escola/vida";
import { paginaMeta } from "@/lib/seo";
import ensinam from "@/content/escola/vida/trabalhadores-que-ensinam.json";
import publicadas from "@/content/escola/vida/vozes.json";
import "@/styles/escola-vida.css";

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return paginaMeta(lang, "/escola/vozes", `${s.meta.vozes.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.vozes.descricao);
}

/** Vozes do trabalho (E4-11): ouvir as publicadas com autorização, os trabalhadores que ensinam e ensaiar a sua, no aparelho. */
export default async function Page({ params }: Props) {
  const { lang } = await loadLang(params);
  const s = textosDaVida(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-pagina-vida="vozes">
      <PageHeading eyebrow={s.vozes.olho} title={s.vozes.titulo} voltar={{ href: localePath(lang, "/escola/vida"), texto: s.comum.voltarVida }}>
        {s.vozes.lead}
      </PageHeading>
      <section className="vida-bloco" aria-labelledby="vozes-publicadas">
        <h2 id="vozes-publicadas" className="vida-titulo">
          {s.vozes.publicadas.titulo}
        </h2>
        <ListaDeVozes vozes={publicadas.vozes as VozPublica[]} s={s.vozes.publicadas} />
        {publicadas.vozes.length > 0 ? <p className="vida-nota">{s.vozes.publicadas.retirar}</p> : null}
      </section>
      <section className="vida-bloco" aria-labelledby="trabalhadores-que-ensinam">
        <h2 id="trabalhadores-que-ensinam" className="vida-titulo">
          {s.vozes.ensinam.titulo}
        </h2>
        <p className="vida-texto">{s.vozes.ensinam.lead}</p>
        <TrabalhadoresQueEnsinam itens={ensinam.itens as TrabalhadorQueEnsina[]} s={s.vozes.ensinam} selo={s.comum.emRevisao} lang={lang} />
      </section>
      <GravadorDeVoz s={s.vozes} selo={s.comum.emRevisao} lang={lang} />
    </div>
  );
}