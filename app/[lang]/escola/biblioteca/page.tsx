// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { prateleirasDaBiblioteca } from "@/components/escola/biblioteca/prateleiras";
import { type LeituraDaBiblioteca, TelaDaBiblioteca } from "@/components/escola/biblioteca/TelaDaBiblioteca";
import { loadLang } from "@/i18n";
import { textosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { getBooks } from "@/lib/content";
import { leiturasGuiadas } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/biblioteca/escola-f6.css";

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/biblioteca">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDaBiblioteca(lang);
  return paginaMeta(lang, "/escola/biblioteca", t.meta.biblioteca.titulo, t.meta.biblioteca.descricao);
}

/**
 * /escola/biblioteca (F6 da Escola de Formação, prancha Biblioteca). Só militante vê a tela (a porta do layout decide);
 * o servidor só manda o que já é público: os textos, as leituras guiadas (content/escola/leituras, as mesmas de
 * /escola/leituras) com o autor e o ano do Acervo, e as prateleiras por caderno.
 */
export default async function Biblioteca({ params }: PageProps<"/[lang]/escola/biblioteca">) {
  const { lang } = await loadLang(params);
  const t = textosDaBiblioteca(lang);
  const livros = getBooks(lang);
  const leituras: LeituraDaBiblioteca[] = leiturasGuiadas().map((l) => {
    const livro = livros.find((b) => b.id === l.obra);
    const autoria = [livro?.author, livro?.year].filter(Boolean).join(", ");
    return { obra: l.obra, titulo: livro?.title ?? l.titulo, autoria };
  });
  const prateleiras = prateleirasDaBiblioteca(textosDaFormacaoBase(lang).hoje.cadernos, t.biblioteca.prateleiras);
  return <TelaDaBiblioteca lang={lang} t={t.biblioteca} leituras={leituras} prateleiras={prateleiras} />;
}
