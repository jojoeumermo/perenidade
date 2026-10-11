// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { PageHeading } from "@/components/PageHeading";
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
      <PageHeading eyebrow={s.eyebrow} title={s.title}>
        {s.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={lang !== defaultLocale} />
      <div className="mt-10 space-y-12" lang="pt-BR">
        {pieces.map((piece) => (
          <article key={piece.slug} id={piece.slug} className="grid scroll-mt-6 gap-6 border-t-4 border-ink pt-6 md:grid-cols-[minmax(0,22rem)_1fr]">
            <figure className="figura m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={piece.imagem} alt={`${piece.titulo}, ${piece.autor}, ${piece.ano}`} width={piece.largura} height={piece.altura} loading="lazy" decoding="async" className="h-auto w-full border border-rule" />
            </figure>
            <div>
              <p className="font-mono text-xs uppercase tracking-widest text-gold">
                {piece.ano} · {piece.lugar}
              </p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight">{piece.titulo}</h2>
              <p className="mt-1 font-sans text-sm text-ink-soft">{piece.autor}</p>
              <p className="mt-4 text-lg leading-relaxed">{piece.texto}</p>
              <p className="mt-4 font-mono text-[0.7rem] text-ink-soft">
                {s.publicDomain}{" "}
                <a href={piece.fonte} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">Wikimedia Commons</a>
              </p>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-12 border-t border-rule pt-4 font-sans text-sm text-ink-soft">{s.note}</p>
    </div>
  );
}
