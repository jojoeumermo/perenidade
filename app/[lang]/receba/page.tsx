// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Capa, Corpo } from "@/components/pagina/Capa";
import { ReceberNoCelular } from "@/components/ReceberNoCelular";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/receba">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/receba", t.receba.eyebrow, t.receba.lead);
}

/** Como entrar no canal do instituto no WhatsApp e no Telegram, que é onde o povo está. */
export default async function Receba({ params }: PageProps<"/[lang]/receba">) {
  const { lang, t } = await loadLang(params);
  const s = t.receba;
  return (
    <>
      <Capa rotulo={s.eyebrow} titulo={s.title}>{s.lead}</Capa>
      <Corpo largura="media">
        <ReceberNoCelular lang={lang} s={s} jornal={localePath(lang, "/jornal")} />
      </Corpo>
    </>
  );
}
