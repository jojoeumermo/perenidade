// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CalendarioDaEscola } from "@/components/escola/calendario/CalendarioDaEscola";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { calendarioAindaProposto } from "@/lib/escola/calendario";
import { semestresNaTela, textosDoCampus } from "@/lib/escola/campus-servidor";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/calendario">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoCampus(lang);
  return paginaMeta(lang, "/escola/calendario", `${s.meta.calendario.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.calendario.descricao);
}

/**
 * O calendário da Escola (E4-09, D1-5, D1-6, D1-7 e R1-46; docs/escola/campus.md): o semestre atual e o próximo, em lista
 * por mês, com a fonte de cada data de fora e o .ics de cada evento. Nenhuma data é inventada: o ano letivo é proposta
 * até a coordenação confirmar, e a página diz isso.
 */
export default async function Page({ params }: PageProps<"/[lang]/escola/calendario">) {
  const { lang } = await loadLang(params);
  const s = textosDoCampus(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-pagina-calendario="">
      <PageHeading eyebrow={s.comum.olho} title={s.meta.calendario.titulo} voltar={{ href: localePath(lang, "/escola"), texto: s.comum.voltar }}>
        {s.meta.calendario.descricao}
      </PageHeading>
      <div className="mt-8">
        <CalendarioDaEscola semestres={semestresNaTela(lang)} s={s.calendario} proposto={calendarioAindaProposto() ? s.comum.proposto : ""} lang={lang} url={site.url} />
      </div>
      <div className="mt-12 space-y-2 border-t border-rule pt-4 font-sans text-sm text-ink-soft">
        <p>{s.calendario.sobreFeriados}</p>
        <p>{s.calendario.sobreExames}</p>
      </div>
    </div>
  );
}
