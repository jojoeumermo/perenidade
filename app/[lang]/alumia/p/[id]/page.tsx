// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { arvoreDeExemplo, previaDaAlumiaLigada } from "@/lib/rede/conversa/exemplos";
import { textosDaRede } from "@/lib/rede/textos";
import { idOk } from "@/lib/rede/tipos";
import { ligado } from "@/lib/recursos";

// Conteúdo da Rede muda a cada minuto e depende de quem lê: nenhuma página aqui é gerada de antemão.
export const dynamicParams = true;

/**
 * Sem nenhum trecho do conteúdo: o título e a prévia de uma página da Rede nunca levam o texto de um post, de um perfil ou de uma
 * comunidade (a matriz de visibilidade vale também para prévia), e a página não é indexada.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: textosDaRede(lang).marca, robots: { index: false, follow: false } };
}

/** Um post da Rede, num endereço próprio (/alumia/p/[id]): o post inteiro e a conversa abaixo dele. Com o recurso "rede-v2" desligado a rota não existe (404): a Rede de hoje fica como está. */
export default async function Pagina({ params }: { params: Promise<{ lang: string; id: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  const { id } = await params;
  if (!idOk(id)) notFound();
  // Na prévia, conversa que não é de nenhum exemplo responde 404 (nunca cai na conversa de outro post).
  if (previaDaAlumiaLigada() && !arvoreDeExemplo(id)) notFound();
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "post", id }} />
      </Suspense>
    </div>
  );
}
