// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Agenda } from "@/components/aovivo/Agenda";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/ao-vivo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/ao-vivo", t.live.title, t.live.description);
}

/** A agenda das aulas ao vivo: o que está no ar, o que vem e as gravações recentes. */
export default async function AoVivo({ params }: PageProps<"/[lang]/ao-vivo">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={t.live.eyebrow} title={t.live.title} slogan={t.slogans.aoVivo} tone="vermelho">
        {t.live.lead}
      </Cartaz>
      <Agenda s={t.live} />
    </div>
  );
}
