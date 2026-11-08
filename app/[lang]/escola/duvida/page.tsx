// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { EscolherComQuem } from "@/components/escola/duvida/EscolherComQuem";
import { loadLang } from "@/i18n";
import { textosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/biblioteca/escola-f6.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/duvida">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDaBiblioteca(lang);
  return paginaMeta(lang, "/escola/duvida", t.meta.duvida.titulo, t.meta.duvida.descricao);
}

/**
 * /escola/duvida (F6 da Escola de Formação, prancha Cel-Dúvida): o "?" da casca e o "Tirar uma dúvida" da coluna levam
 * aqui; a aula pode mandar ?aula=F-0304&de=/escola/formacao/... para a tela dizer de que aula se trata. O servidor só
 * manda os textos; quem acompanha e o núcleo vêm de escola_eu, no navegador.
 */
export default async function Duvida({ params }: PageProps<"/[lang]/escola/duvida">) {
  const { lang } = await loadLang(params);
  return <EscolherComQuem lang={lang} t={textosDaBiblioteca(lang).duvida} />;
}
