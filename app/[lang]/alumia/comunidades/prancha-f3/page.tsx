// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BancaF3 } from "@/components/rede/comunidades/BancaF3";
import { loadLang } from "@/i18n";
import { previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { comTextos } from "@/lib/rede/textos-comunidades";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * A banca de conferência da F3 (/alumia/comunidades/prancha-f3?tela=comunidade|conversa): as telas novas com os dados de exemplo
 * das pranchas, para as fotos em 375 e 1440 px. SÓ existe na máquina de quem desenvolve (NEXT_PUBLIC_ALUMIA_PREVIA=sim) e com a
 * Alumia nova ligada; em produção a variável não existe e a rota responde 404.
 */
export default async function Pagina({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ tela?: string }> }) {
  if (!previaDaAlumiaLigada() || !alumia2Ligada()) notFound();
  const { lang } = await loadLang(params);
  const { tela } = await searchParams;
  const s = comTextos(lang);
  return <BancaF3 lang={lang} s={s} sc={s.comunidades} tela={tela === "conversa" ? "conversa" : "comunidade"} />;
}
