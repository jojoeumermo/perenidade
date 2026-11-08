// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { CabecaDoVale } from "@/components/vale-o-escrito/Cabeca";
import { Observatorio } from "@/components/vale-o-escrito/Observatorio";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { dadosDoObservatorio } from "@/lib/vale-o-escrito/consulta";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

// Os casos aprovados no banco entram sem novo deploy: a página é refeita a cada 5 minutos (lib/vale-o-escrito/banco.ts).
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito", s.meta.titulo, s.meta.descricao);
}

/**
 * A entrada do Vale o Escrito: a página única do observatório, em linguagem de painel de investigação (preto profundo e vermelho sangue) (pacote "visual"). É o ÚNICO lugar do site fora da
 * identidade do instituto (styles/vale-o-escrito.css, com escopo ".ve": não toca o tema). O servidor lê os arquivos
 * conferidos (lib/vale-o-escrito/consulta.ts) e entrega ao componente de cliente; D3 (teia) e MapLibre (mapa) só chegam
 * ao navegador quando a visão é aberta. O layout (layout.tsx) já devolve 404 com o recurso desligado.
 */
export default async function ValeOEscrito({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  // Com o recurso desligado o layout já respondeu 404; esta conferência só protege uma página usada fora do layout.
  if (!ligado("vale-o-escrito")) {
    return (
      <div className="ve-pagina ve-doc">
        <CabecaDoVale olho={s.emPreparacao.olho} titulo={s.emPreparacao.titulo}>
          {s.emPreparacao.texto}
        </CabecaDoVale>
      </div>
    );
  }
  return <Observatorio dados={await dadosDoObservatorio(lang)} s={s} lang={lang} />;
}
