// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";
import { TERMO_SAUDE } from "@/lib/termos";

export async function generateMetadata({ params }: PageProps<"/[lang]/saude/termo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/saude/termo", `${t.saude.title}: termo`, t.saude.description);
}

/** O termo que cada profissional aceita no painel, em público: quem procura atendimento sabe o que o instituto faz e o que não faz. */
export default async function TermoDaSaude({ params }: PageProps<"/[lang]/saude/termo">) {
  const { lang, t } = await loadLang(params);
  return (
    <article className="mx-auto max-w-3xl px-4 py-12" lang="pt-BR">
      <PageHeading eyebrow={t.saude.title} title="Termo da vitrine">
        {TERMO_SAUDE.titulo}. Versão {TERMO_SAUDE.versao}.
      </PageHeading>
      <p className="mt-6 border-l-4 border-gold bg-parchment-deep px-4 py-2 font-sans text-sm">Rascunho em revisão jurídica: o texto pode mudar. Cada profissional aceita a versão vigente no painel; mudou a versão, o perfil sai do ar até um novo aceite.</p>
      <ol className="mt-8 list-decimal space-y-4 pl-6 text-lg leading-relaxed">
        {TERMO_SAUDE.clausulas.map((c) => <li key={c}>{c}</li>)}
      </ol>
      <p className="mt-10 font-sans"><Link href={localePath(lang, "/saude")} className="underline hover:text-oxblood">← Voltar à vitrine</Link></p>
    </article>
  );
}
