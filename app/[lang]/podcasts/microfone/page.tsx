// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { TesteDeMicrofone } from "@/components/podcast/Microfone";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/podcasts/microfone">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/podcasts/microfone", t.podcast.micTitle, t.podcast.micLead);
}

/** Teste de microfone aberto a qualquer pessoa: convidado, ouvinte que vai mandar pergunta gravada, quem grava em casa. */
export default async function Microfone({ params }: PageProps<"/[lang]/podcasts/microfone">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href={localePath(lang, "/podcasts")} className="voltar-da-pagina font-sans text-sm text-ink-soft hover:text-oxblood">← {t.podcast.title}</Link>
      <div className="mt-6">
        <Cartaz eyebrow={t.podcast.eyebrow} title={t.podcast.micShort} slogan={t.slogans.podcasts} tone="preto" />
      </div>
      <div className="mt-8">
        <TesteDeMicrofone s={t.podcast} />
      </div>
    </div>
  );
}
