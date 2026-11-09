// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { rotaNova, rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaOnda5, textosDaTela } from "@/lib/rede/textos-onda5";

/**
 * Os metadados de uma rota nova da Onda 5: com a flag desligada, nada (a página dá 404); ligada, só o nome da tela e da rede,
 * sem trecho de conteúdo. Só indexa o que é público e igual para todo mundo (lib/rede/rotas-novas.ts, `indexar`).
 */
export async function metadadosDaRotaNova(nome: string, params: Promise<{ lang: string }>): Promise<Metadata> {
  if (!rotaNovaLigada(nome)) return {};
  const { lang } = await loadLang(params);
  const tela = textosDaTela(await carregarTextosDaOnda5(lang), nome);
  const marca = textosDaRede(lang).marca;
  return {
    title: tela ? `${tela.titulo} · ${marca}` : marca,
    robots: rotaNova(nome)?.indexar ? undefined : { index: false, follow: false },
  };
}

/**
 * A página de uma rota nova: 404 com as flags desligadas ("rede-v2", "alumia-2" e a da tela); ligadas, a casca da Alumia com a
 * tela registrada em components/rede/registro.tsx (por enquanto, "em construção").
 */
export async function PaginaNova({ nome, params, extras }: { nome: string; params: Promise<{ lang: string }>; extras?: Record<string, string> }) {
  if (!rotaNovaLigada(nome)) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome, params: extras }} />
      </Suspense>
    </div>
  );
}
