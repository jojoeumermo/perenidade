// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { DosTerritorios } from "@/components/territorios/NoticiasDoTerritorio";
import { territorios } from "@/lib/territorios";
import { Arquivo } from "@/components/jornal/Arquivo";
import { MateriaCompleta } from "@/components/jornal/MateriaCompleta";
import { loadLang } from "@/i18n";
import { getArticles } from "@/lib/content";
import { ultimaMateria } from "@/lib/jornal/selecao";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/jornal">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/jornal", t.journal.title, t.journal.lead);
}

/**
 * /jornal abre direto a última matéria publicada, inteira, com o "Leia também" e o link do arquivo no fim. Sem matéria
 * ainda, mostra o arquivo vazio (o cartaz de "no prelo").
 */
export default async function Jornal({ params }: PageProps<"/[lang]/jornal">) {
  const { lang, t } = await loadLang(params);
  const articles = getArticles(lang);
  const ultima = ultimaMateria(articles);
  // "Dos territórios" (09/11/2026): as últimas novidades postadas pelos coletivos parceiros, abaixo da edição.
  const nomes = Object.fromEntries(territorios.map((x) => [x.slug, x.nome]));
  return (
    <>
      {ultima ? <MateriaCompleta lang={lang} t={t} article={ultima} articles={articles} ultima /> : <Arquivo lang={lang} t={t} />}
      <DosTerritorios nomes={nomes} />
    </>
  );
}
