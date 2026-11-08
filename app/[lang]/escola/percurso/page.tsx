// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import { cadernosDoQuadro } from "@/components/escola/hoje/cadernos-do-quadro";
import { TelaDoPercurso, type CadernoDoPercurso } from "@/components/escola/percurso/TelaDoPercurso";
import { loadLang } from "@/i18n";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { textosDoPercurso } from "@/i18n/escola/percurso";
import { CADERNOS_DA_ESCOLA } from "@/lib/escola/contratos";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/percurso/percurso.css";

// O aviso da carteirinha ("não é documento oficial") em EB Garamond itálico, como na prancha (SIL Open Font License 1.1).
// Sem pré-carregar: só vem quando a carteirinha aparece.
const aviso = EB_Garamond({ variable: "--font-escola-aviso", subsets: ["latin", "latin-ext"], weight: ["500"], style: ["italic"], preload: false });

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/percurso">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDoPercurso(lang);
  return { ...paginaMeta(lang, "/escola/percurso", t.meta.titulo, t.meta.descricao), robots: { index: false, follow: false } };
}

/**
 * /escola/percurso: Meu percurso (Escola de Formação, F5). A porta do layout só mostra a tela a militante, conferido no
 * banco. O servidor manda só o que é público: os textos de interface e as aulas escritas de cada caderno (as mesmas
 * de /trilhas, só o id, para contar no aparelho). A carteirinha, o degrau e as conquistas vêm do banco no navegador,
 * depois da sessão; o que a pessoa estudou fica no aparelho.
 */
export default async function MeuPercurso({ params }: PageProps<"/[lang]/escola/percurso">) {
  const { lang } = await loadLang(params);
  const base = textosDaFormacaoBase(lang);
  const cadernos: CadernoDoPercurso[] = cadernosDoQuadro(lang, base.hoje.cadernos).map((c) => ({
    numero: c.numero,
    degrau: c.degrau,
    nome: c.nome,
    slug: CADERNOS_DA_ESCOLA.find((x) => x.numero === c.numero)?.slug,
    aulas: c.aulas.map((a) => ({ id: a.id })),
  }));
  const { percurso, degrau1, degrau3, voceCaderno, emPreparacao } = base.hoje;
  return (
    <div className={aviso.variable}>
      <TelaDoPercurso lang={lang} t={textosDoPercurso(lang)} tHoje={{ percurso, degrau1, degrau3, voceCaderno, emPreparacao }} cadernos={cadernos} />
    </div>
  );
}
