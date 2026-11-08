// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import pautaBruta from "@/content/escola/assembleia.json";
import { cartaoDaAssembleia } from "@/components/escola/frente2/frentes";
import { TelaDaFrente } from "@/components/escola/frente2/TelaDaFrente";
import { loadLang } from "@/i18n";
import { textosDaBiblioteca } from "@/i18n/escola/biblioteca";
import { assembleiaAberta, limitesDoSemestre, validarPauta } from "@/lib/escola/organizacao";
import { hojeEmBrasilia } from "@/lib/escola/tempo";
import { paginaMeta } from "@/lib/seo";
import "@/components/escola/biblioteca/escola-f6.css";

// O dia muda a situação da assembleia (abre, fecha): a página se refaz a cada hora, como /escola/assembleia.
export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/escola/frente">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const t = textosDaBiblioteca(lang);
  return paginaMeta(lang, "/escola/frente", t.meta.frente.titulo, t.meta.frente.descricao);
}

/**
 * /escola/frente (F6 da Escola de Formação, prancha Frente). Só militante vê a tela (a porta do layout decide). O
 * servidor manda os textos e a situação da Assembleia do semestre, calculada da pauta pública
 * (content/escola/assembleia.json, a mesma de /escola/assembleia). A frente do militante e as somas vêm do banco.
 */
export default async function Frente({ params }: PageProps<"/[lang]/escola/frente">) {
  const { lang } = await loadLang(params);
  const t = textosDaBiblioteca(lang);
  const { pauta } = validarPauta(pautaBruta);
  const situacao = assembleiaAberta(pauta, hojeEmBrasilia());
  const assembleia = cartaoDaAssembleia(situacao, pauta, pauta ? (limitesDoSemestre(pauta.semestre)?.fim ?? null) : null);
  return <TelaDaFrente lang={lang} t={t.frente} assembleia={assembleia} />;
}
