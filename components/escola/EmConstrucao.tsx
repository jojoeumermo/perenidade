// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { rotaDe } from "@/lib/escola/rotas";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

type ChaveDaPagina = keyof ReturnType<typeof textosDaBase>["paginas"];

/** Metadados de uma página provisória: título da parte da Escola e fora da busca (noindex). */
export async function metaEmConstrucao(params: Promise<{ lang: string }>, chave: ChaveDaPagina): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  const caminho = rotaDe(`/escola/${chave}`)?.caminho ?? `/escola/${chave}`;
  return { ...paginaMeta(lang, caminho, `${s.paginas[chave]} · ${s.meta.titulo}`, s.emConstrucao.titulo), robots: { index: false, follow: true } };
}

/**
 * Página provisória de uma parte da Escola que outro pacote da Etapa 4 ainda vai montar: diz que está sendo montada,
 * sem prometer data, e leva de volta à entrada. Cada pacote dono substitui a sua (lib/escola/rotas.ts).
 */
export async function EmConstrucao({ params, chave }: { params: Promise<{ lang: string }>; chave: ChaveDaPagina }) {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-em-construcao={chave}>
      <PageHeading eyebrow={s.meta.titulo} title={s.paginas[chave]} voltar={{ href: localePath(lang, "/escola"), texto: s.nav.entrada }} />
      <section className="mt-8 border border-rule bg-parchment-deep p-6 font-sans">
        <h2 className="font-serif text-2xl font-semibold">{s.emConstrucao.titulo}</h2>
        <p className="mt-3 text-ink-soft">{s.emConstrucao.texto}</p>
        <Link href={localePath(lang, "/escola")} className="mt-5 inline-flex min-h-11 items-center border-2 border-ink px-5 py-2.5 font-medium hover:border-oxblood hover:text-oxblood">
          ← {s.emConstrucao.voltar}
        </Link>
      </section>
    </div>
  );
}
