// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { NOME_VITRINE } from "@/lib/mural-saude";
import { paginaMeta } from "@/lib/seo";
import { TERMO_SAUDE } from "@/lib/termos";

export async function generateMetadata({ params }: PageProps<"/[lang]/saude/termo">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/saude/termo", `${t.saude.title}: termo`, t.saude.description);
}

/** O termo que cada profissional aceita no painel, em público: quem procura atendimento sabe o que o instituto faz e o que não faz. */
export default async function TermoDaSaude({ params }: PageProps<"/[lang]/saude/termo">) {
  const { lang } = await loadLang(params);
  return (
    <div className="mural-de-saude bg-parchment-deep text-ink">
      <article className="mx-auto max-w-3xl px-4 py-12" lang="pt-BR">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">{NOME_VITRINE}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">Termo do mural</h1>
        <p className="mt-3 text-lg">{TERMO_SAUDE.titulo}. Versão {TERMO_SAUDE.versao}.</p>
        <p className="mt-6 border-l-2 border-ink/50 bg-folha px-4 py-2 font-sans text-sm">Rascunho em revisão jurídica: o texto pode mudar. Cada profissional aceita a versão vigente no painel; mudou a versão, o perfil sai do ar até um novo aceite.</p>
        <ol className="mt-8 list-decimal space-y-4 pl-6 text-lg leading-relaxed">
          {TERMO_SAUDE.clausulas.map((c) => <li key={c}>{c}</li>)}
        </ol>
        <p className="mt-10 font-sans">
          <Link href={localePath(lang, "/saude")} className="underline hover:no-underline">← Voltar ao mural</Link>
          {" · "}
          <Link href={localePath(lang, "/saude/neutralidade")} className="underline hover:no-underline">Neutralidade do mural</Link>
        </p>
      </article>
    </div>
  );
}
