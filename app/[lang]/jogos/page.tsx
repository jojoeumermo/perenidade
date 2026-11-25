// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { loadLang } from "@/i18n";
import { textosDosJogos } from "@/i18n/jogos";
import { PaginaDosJogosServidor } from "@/lib/jogos/pagina-servidor";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/jogos">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const j = textosDosJogos(lang);
  return paginaMeta(lang, "/jogos", j.meta.titulo, j.meta.descricao);
}

/** Jogos: o catálogo e o palco moram em lib/jogos/pagina-servidor.tsx (o aplicativo instalado usa o mesmo, em lista compacta). */
export default function Page({ params }: PageProps<"/[lang]/jogos">) {
  return <PaginaDosJogosServidor params={params} />;
}
