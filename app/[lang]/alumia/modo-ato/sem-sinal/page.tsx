// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuiaSemSinal } from "@/components/rede/modoato/GuiaSemSinal";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { carregarTextosDoModoAto } from "@/lib/rede/modoato/textos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";

const ligada = (): boolean => alumia2Ligada() && ligado("alumia-modo-ato");

/** O guia é igual para todo mundo e não tem dado de ninguém: pode ser indexado. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/modo-ato/sem-sinal">): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoModoAto(lang);
  return { title: `${t.guia.titulo} · ${textosDaRede(lang).marca}`, description: t.guia.chamada };
}

/**
 * O guia "Sem sinal?" (/alumia/modo-ato/sem-sinal). Frente 9C. Sai pronto do servidor (sem a casca, sem banco, sem conta), para
 * o service worker guardar o HTML inteiro e o guia abrir sem internet. Desligado, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/modo-ato/sem-sinal">) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  const t = await carregarTextosDoModoAto(lang);
  return <GuiaSemSinal t={t} lang={lang} />;
}
