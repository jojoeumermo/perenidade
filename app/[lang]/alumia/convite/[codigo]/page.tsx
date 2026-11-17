// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PaginaDoConvite } from "@/components/rede/convites/PaginaDoConvite";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { alumiaComEndereco } from "@/lib/rede/alumia";
import { carregarTextosDosConvites } from "@/lib/rede/convites/textos";
import { figurasDaEntrada } from "@/lib/rede/entrada/figuras";
import { textosDaEntrada } from "@/lib/rede/entrada/textos";
import { site } from "@/lib/site";

const ligada = () => ligado("alumia-convites");
const CODIGO = /^[0-9a-f]{32}$/;

export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/convite/[codigo]">): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDosConvites(lang);
  // Página de uma pessoa só (o código é dela): fora da busca, sem trecho.
  return { title: `${t.pagina.titulo} · Alumia`, robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/**
 * O convite para a Alumia (/alumia/convite/<código>). Abre sem conta (a entrada deixa passar: LIVRES_DA_PORTA em
 * components/rede/convites/encaixe-da-entrada.ts). O servidor não lê o código aqui: o navegador guarda e pergunta à rota da porta
 * se ele vale. Com a flag "alumia-convites" desligada, ou código torto, 404.
 */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/convite/[codigo]">) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  const { codigo } = await params;
  if (!CODIGO.test(codigo)) notFound();
  return (
    <PaginaDoConvite
      lang={lang}
      t={textosDaEntrada(lang)}
      tc={await carregarTextosDosConvites(lang)}
      figuras={figurasDaEntrada()}
      site={alumiaComEndereco ? `${site.url}/${lang}` : `/${lang}`}
      codigo={codigo}
    />
  );
}
