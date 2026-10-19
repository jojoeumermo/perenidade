// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeuEstudo } from "@/components/estudo/MeuEstudo";
import { MinhasTurmas } from "@/components/estudo/MinhasTurmas";
import { RegistroDeConclusao } from "@/components/estudo/RegistroDeConclusao";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

export async function generateMetadata({ params }: PageProps<"/[lang]/meu-estudo">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  // Página pessoal (mostra o que está no aparelho de cada um): não entra na busca.
  return { ...paginaMeta(lang, "/meu-estudo", s.meuEstudo.titulo, s.meuEstudo.descricao), robots: { index: false, follow: true } };
}

/** Meu estudo (recurso "meu-estudo"): o painel do que a pessoa estudou, montado no aparelho dela. Desligado, a página não existe. */
export default async function Page({ params }: PageProps<"/[lang]/meu-estudo">) {
  if (!ligado("meu-estudo")) notFound();
  const { lang, t } = await loadLang(params);
  const { s, traduzido } = textosDoEstudo(lang);
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <PageHeading eyebrow={s.meuEstudo.olho} title={s.meuEstudo.titulo}>
        {s.meuEstudo.lead}
      </PageHeading>
      <Untranslated lang={lang} t={t} show={!traduzido} />
      <RegistroDeConclusao />
      <MeuEstudo s={s.meuEstudo} caderno={t.notebook} praticar={ligado("exercicios")} extras={ligado("turma") ? <MinhasTurmas s={s.turma} /> : null} />
    </div>
  );
}
