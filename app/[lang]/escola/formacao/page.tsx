// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { ComoPassar } from "@/components/escola/formacao/ComoPassar";
import { Degraus } from "@/components/escola/formacao/Degraus";
import { cadernosVistos, partesComNegrito } from "@/components/escola/formacao/vista";
import { loadLang } from "@/i18n";
import { textosDaFormacao } from "@/i18n/escola/formacao";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/formacao/formacao.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/formacao">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDaFormacao(lang);
  return { ...paginaMeta(lang, "/escola/formacao", t.meta.formacao, t.meta.formacaoDescricao), robots: { index: false } };
}

/**
 * /escola/formacao (pranchas Formação e Cel-Formação): os três degraus e os onze cadernos, com a contagem real das aulas.
 * Só militante vê (a porta do layout decide). O servidor manda só conteúdo público (as mesmas trilhas de /trilhas); o
 * que a pessoa já fez fica no aparelho e é cruzado no navegador.
 */
export default async function Formacao({ params }: PageProps<"/[lang]/escola/formacao">) {
  const { lang, t: site } = await loadLang(params);
  const t = textosDaFormacao(lang);
  const cadernos = cadernosVistos(lang, textosDaFormacaoBase(lang).hoje.cadernos, site.despertar.lead).map((c) => ({
    numero: c.numero,
    degrau: c.degrau,
    nome: c.nome,
    href: c.href,
    contagem: c.contagem,
    prontas: c.prontas.map((a) => a.id),
  }));
  return (
    <div className="eff-formacao" data-escola-escura="" data-tela-da-escola="formacao">
      <h1 className="ef-t eff-titulo">{t.formacao.titulo}</h1>
      <p className="eff-lead">{partesComNegrito(t.formacao.lead).map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}</p>
      <Degraus lang={lang} cadernos={cadernos} t={t.formacao} />
      <ComoPassar t={t.formacao.como} />
    </div>
  );
}
