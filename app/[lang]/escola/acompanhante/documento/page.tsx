// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { LeitorDeDocumento } from "@/components/escola/acompanhante/LeitorDeDocumento";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/acompanhante/documento">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  return paginaMeta(lang, "/escola/acompanhante/documento", `${s.documento.titulo} · ${s.meta.titulo}`, s.documento.lead);
}

/** Acompanhante do estudante (E4-10, docs/escola/acompanhante.md). */
export default async function PaginaLeitorDeDocumento({ params }: PageProps<"/[lang]/escola/acompanhante/documento">) {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 font-sans" data-acompanhante="documento">
      <PageHeading eyebrow={textosDaBase(lang).meta.titulo} title={s.documento.titulo} voltar={{ href: localePath(lang, "/escola/acompanhante"), texto: s.hub.titulo }} />
      <p className="mt-6 text-lg">{s.documento.lead}</p>
      <div className="mt-8">
        <LeitorDeDocumento s={s} />
      </div>
      <p className="mt-10 text-sm">
        <Link href={localePath(lang, "/escola/acompanhante/como-funciona")} className="underline hover:text-oxblood">
          {s.comum.comoFunciona}
        </Link>
      </p>
    </div>
  );
}
