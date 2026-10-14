// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { PaginaDoConvidado } from "@/components/podcast/Convidado";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/podcasts/convidado">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.podcast.guestTitle, robots: { index: false, follow: false } };
}

/** Aberta pelo link pessoal que a produção manda ao convidado. Sem o link, não mostra nada de ninguém. */
export default async function Convidado({ params }: PageProps<"/[lang]/podcasts/convidado">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Cartaz eyebrow={t.podcast.eyebrow} title={t.podcast.guestTitle} slogan={t.footer.slogan} tone="vermelho">
        {t.podcast.guestLead}
      </Cartaz>
      <PaginaDoConvidado s={t.podcast} />
    </div>
  );
}
