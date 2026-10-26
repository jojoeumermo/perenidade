// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { NOME_VITRINE, TEXTOS } from "@/lib/mural-saude";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/saude/neutralidade">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  return paginaMeta(lang, "/saude/neutralidade", `${NOME_VITRINE}: ${TEXTOS.neutralidade.titulo.toLowerCase()}`, TEXTOS.neutralidade.paragrafos[0]);
}

/** A página curta que o rodapé do mural aponta: o mural é só um mural de contatos, independente das posições do instituto. */
export default async function NeutralidadeDoMural({ params }: PageProps<"/[lang]/saude/neutralidade">) {
  const { lang } = await loadLang(params);
  return (
    <div className="mural-de-saude bg-[#F4EBDB] text-[#221C17]">
      <article className="mx-auto max-w-3xl px-4 py-12" lang="pt-BR">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#221C17]/70">{NOME_VITRINE}</p>
        <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">{TEXTOS.neutralidade.titulo}</h1>
        <div className="mt-6 space-y-4 text-lg leading-relaxed">
          {TEXTOS.neutralidade.paragrafos.map((p) => <p key={p}>{p}</p>)}
        </div>
        <p className="mt-10 font-sans">
          <Link href={localePath(lang, "/saude")} className="underline hover:no-underline">← Voltar ao mural</Link>
          {" · "}
          <Link href={localePath(lang, "/saude/termo")} className="underline hover:no-underline">Termo do mural</Link>
        </p>
      </article>
    </div>
  );
}
