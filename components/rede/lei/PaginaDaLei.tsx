// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaLei } from "./textos";

/** As quatro telas da frente 8B com rota própria (o que guardamos continua na rota da onda 5, lib/rede/rotas-novas.ts). */
export type TelaDaLei = "termos" | "privacidade" | "regras" | "ajuda";

/**
 * Os metadados: só o nome da página e o da rede. São páginas públicas e iguais para todo mundo (o combinado da casa), então podem
 * ser indexadas. Com a Alumia nova desligada, nada (a página dá 404).
 */
export async function metadadosDaLei(nome: TelaDaLei, params: Promise<{ lang: string }>): Promise<Metadata> {
  if (!alumia2Ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaLei(lang);
  const titulo = { termos: t.termos.titulo, privacidade: t.privacidade.titulo, regras: t.regras.titulo, ajuda: t.ajuda.titulo }[nome];
  return { title: `${titulo} · ${textosDaRede(lang).marca}` };
}

/**
 * A página: 404 com "rede-v2" ou "alumia-2" desligadas; ligadas, a casca da Alumia com a tela registrada em
 * components/rede/registro.tsx (quem junta acrescenta as quatro linhas). Sem conta, o portão da entrada deixa estas páginas
 * abertas (LIVRES em components/rede/entrada/PortaoDaAlumia.tsx, também com quem junta).
 */
export async function PaginaDaLei({ nome, params }: { nome: TelaDaLei; params: Promise<{ lang: string }> }) {
  if (!alumia2Ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome }} />
      </Suspense>
    </div>
  );
}
