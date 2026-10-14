// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Materials } from "@/components/Materials";
import { Cartaz } from "@/components/Cartaz";
import { loadLang } from "@/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/materiais">): Promise<Metadata> {
  const { t } = await loadLang(params);
  return { title: t.materials.title, description: t.materials.description };
}

// Materiais para imprimir e distribuir: zines, panfletos, cartazes e banners publicados pela coordenação.
export default async function Materiais({ params }: PageProps<"/[lang]/materiais">) {
  const { t } = await loadLang(params);
  const s = t.materials;
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <Cartaz eyebrow={s.eyebrow} title={s.title} slogan={t.footer.slogan} tone="vermelho">
        {s.lead}
      </Cartaz>
      <Materials s={s} />
    </div>
  );
}
