// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Tela } from "@/lib/rede/tipos";
import { EsqueletoDaCasca } from "./Esqueletos";

// A Rede v2 inteira só vem ao navegador quando a página dela abre (não vai no pacote da página, nem no de quem não usa a Rede):
// no celular de entrada e no 3G isso é o que importa. Até chegar, o esqueleto ocupa o lugar da casca, e nada pula.
const Rede = dynamic(() => import("./Rede"), {
  ssr: false,
  loading: () => <EsqueletoDaCasca rotulo="…" />,
});

/** A porta de entrada da v2 nas páginas (servidor): recebe os textos de UM idioma e a tela, e carrega a Rede sob demanda. */
export function RedeSobDemanda({ lang, s, tela }: { lang: string; s: TextosDaRede; tela: Tela }) {
  return <Rede lang={lang} s={s} tela={tela} />;
}
