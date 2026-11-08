// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SalaDaEscola } from "@/components/escola/aovivo/SalaDaEscola";
import { loadLang } from "@/i18n";
import { textosDoAoVivo } from "@/i18n/escola/aovivo";

export const dynamicParams = true;

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Página fechada: título genérico (nada da aula) e fora dos buscadores. */
export async function generateMetadata({ params }: PageProps<"/[lang]/escola/ao-vivo/[id]">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDoAoVivo(lang);
  return { title: t.meta.titulo, description: t.meta.descricao, robots: { index: false, follow: false } };
}

/**
 * /escola/ao-vivo/[id]: a sala da aula ao vivo da Escola (PLANO-ESCOLA.md, F3). O layout da Escola só monta a página
 * para militante (a porta confere escola_eu no banco). O servidor manda só os textos de interface e o id do endereço;
 * a aula, o vídeo e o bate-papo vêm das funções do banco no navegador, depois da sessão.
 */
export default async function SalaAoVivoDaEscola({ params }: PageProps<"/[lang]/escola/ao-vivo/[id]">) {
  const { lang } = await loadLang(params);
  const { id } = await params;
  if (!ID.test(id)) notFound();
  return <SalaDaEscola id={id} lang={lang} t={textosDoAoVivo(lang)} />;
}
