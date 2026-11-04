// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { FormularioCorrecao } from "@/components/vale-o-escrito/FormularioCorrecao";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito/correcao", s.correcao.titulo, s.correcao.lead);
}

/** Correção e direito de resposta, sem ficha escolhida: a pessoa digita o código da ficha. Com a ficha, use correcao/[id]. */
export default async function CorrecaoSemFicha({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.entrada.titulo} title={s.correcao.titulo} voltar={{ href: localePath(lang, "/vale-o-escrito"), texto: s.navegacao.inicio }}>
        {s.correcao.lead}
      </PageHeading>
      <FormularioCorrecao s={{ correcao: s.correcao, erros: s.erros }} />
      <p className="mt-8 font-sans text-sm">
        <Link className="underline" href={localePath(lang, "/vale-o-escrito/sobre")}>
          {s.navegacao.sobre}
        </Link>
      </p>
    </div>
  );
}
