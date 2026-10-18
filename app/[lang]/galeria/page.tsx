// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { GaleriaGrade } from "@/components/GaleriaGrade";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { defaultLocale } from "@/i18n/config";
import { getGallery } from "@/lib/content";

export async function generateMetadata({ params }: PageProps<"/[lang]/galeria">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.gallery.title, description: t.gallery.description };
}

// A arte que os trabalhadores fizeram para si mesmos: cada peça com quem fez, quando, por quê e de onde veio a imagem.
export default async function Galeria({ params }: PageProps<"/[lang]/galeria">) {
  const { lang, t } = await loadLang(params);
  const s = t.gallery;
  const pieces = getGallery();
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.slogans.galeria} tone="vermelho">
        {s.lead}
      </Cartaz>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <GaleriaGrade pecas={pieces} publicDomain={s.publicDomain} />
      <p className="mt-12 border-t border-rule pt-4 font-sans text-sm text-ink-soft">{s.note}</p>
    </div>
  );
}
