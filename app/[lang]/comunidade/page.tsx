// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { Forum } from "@/components/Forum";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/comunidade">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.community.title, description: t.community.lead };
}

export default async function Comunidade({ params }: PageProps<"/[lang]/comunidade">) {
  const { t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Cartaz eyebrow={t.community.eyebrow} title={t.community.title} slogan={t.footer.slogan} tone="vermelho">
        {t.community.lead}
      </Cartaz>
      <ul className="mt-6 list-disc space-y-1 pl-5 font-sans text-sm text-ink-soft">
        {t.community.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <Suspense>
        <Forum s={t.community} />
      </Suspense>
    </div>
  );
}
