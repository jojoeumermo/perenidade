// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { Gaveta } from "@/components/Gaveta";
import { Markdown } from "@/components/Markdown";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { getPage } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/gaveta">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/gaveta", t.drawer.title, t.drawer.description);
}

// Gaveta Aberta: o trabalho que ficou parado depois da entrega (o TCC, o projeto da disciplina, a apostila) volta a
// servir a alguém. Quem fez publica sob licença livre, com o termo aceito; a mediação confere antes de aparecer.
export default async function GavetaPage({ params }: PageProps<"/[lang]/gaveta">) {
  const { lang, t } = await loadLang(params);
  const s = t.drawer;
  const termo = getPage("gaveta-termo", lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={s.tagline} tone="vermelho">
        {s.lead}
      </Cartaz>
      <Gaveta s={s} termo={<Markdown lang={lang}>{termo.body}</Markdown>} />
    </div>
  );
}
