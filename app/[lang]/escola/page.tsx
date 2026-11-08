// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { cadernosDoQuadro } from "@/components/escola/hoje/cadernos-do-quadro";
import { TelaDeHoje } from "@/components/escola/hoje/TelaDeHoje";
import { loadLang } from "@/i18n";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDaFormacaoBase(lang);
  return paginaMeta(lang, "/escola", t.meta.titulo, t.meta.descricao);
}

/**
 * /escola: para quem não é militante, a porta vermelha (o layout decide, components/escola/PortaDaEscola.tsx); para o
 * militante, a tela Hoje. O servidor só manda o que é público: os textos de interface e a lista das aulas escritas de
 * cada caderno (as mesmas de /trilhas). O que é da pessoa (núcleo, quem acompanha, recados, pergunta, aula ao vivo)
 * vem do banco no navegador, depois da sessão; o que ela já estudou fica no aparelho.
 */
export default async function Escola({ params }: PageProps<"/[lang]/escola">) {
  const { lang } = await loadLang(params);
  const t = textosDaFormacaoBase(lang);
  return <TelaDeHoje lang={lang} t={t.hoje} cadernos={cadernosDoQuadro(lang, t.hoje.cadernos)} />;
}
