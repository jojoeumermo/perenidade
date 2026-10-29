// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Suspense } from "react";
import { SalaDeAula } from "@/components/aovivo/Sala";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

export async function generateMetadata({ params }: PageProps<"/[lang]/ao-vivo/sala">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.live.room, robots: { index: false, follow: false } };
}

/** A sala de uma aula ao vivo (a aula vem no endereço: ?aula=…). */
export default async function Sala({ params }: PageProps<"/[lang]/ao-vivo/sala">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={localePath(lang, "/ao-vivo")} className="voltar-da-pagina font-sans text-sm text-ink-soft hover:text-oxblood">← {t.live.title}</Link>
      <Suspense>
        <SalaDeAula s={t.live} />
      </Suspense>
    </div>
  );
}
