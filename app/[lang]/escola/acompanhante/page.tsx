// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Escolha } from "@/components/escola/acompanhante/Escolha";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { textosDoAcompanhante } from "@/i18n/escola/acompanhante";
import { textosDosAgentes } from "@/i18n/escola/agentes";
import { textosDaBase } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/acompanhante">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  return paginaMeta(lang, "/escola/acompanhante", `${s.meta.titulo} · ${textosDaBase(lang).meta.titulo}`, s.meta.descricao);
}

/**
 * O acompanhante do estudante (Etapa 4, E4-10; docs/escola/acompanhante.md): a escolha do modo e as conversas
 * guardadas só neste aparelho. Tudo o que vai para o assistente é dito antes do botão.
 */
export default async function Acompanhante({ params }: PageProps<"/[lang]/escola/acompanhante">) {
  const { lang } = await loadLang(params);
  const s = textosDoAcompanhante(lang);
  const base = textosDaBase(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 font-sans" data-acompanhante="">
      <PageHeading eyebrow={base.meta.titulo} title={s.hub.titulo} voltar={{ href: localePath(lang, "/escola"), texto: base.nav.entrada }} />
      <p className="mt-6 max-w-2xl text-lg">{s.hub.lead}</p>
      <p className="mt-2 text-sm">
        <Link href={localePath(lang, "/escola/acompanhante/como-funciona")} className="underline hover:text-oxblood">
          {s.comum.comoFunciona}
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link href={localePath(lang, "/escola/agentes")} className="underline hover:text-oxblood">
          {textosDosAgentes(lang).hub.linkDoAcompanhante}
        </Link>
      </p>
      <div className="mt-8">
        <Escolha s={s} />
      </div>
    </div>
  );
}
