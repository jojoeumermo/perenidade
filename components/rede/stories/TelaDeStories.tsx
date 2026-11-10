// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "../conversa/alumia3.css";
import "./stories.css";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { PropsDaTelaDoPacote } from "../registro";
import { DestaquesDoPerfil } from "./Destaques";
import StoriesNoAlto from "./NoAlto";
import { useTextosDosStories } from "./usar";

/**
 * Os stories (/alumia/stories; pranchas celular-stories-na-linha, celular-criar-story e celular-ver-story): o mesmo cabeçalho das
 * outras telas (h1 "Stories"), a faixa (a mesma do alto da linha de Início, components/rede/stories/NoAlto.tsx) e os meus
 * destaques. A linha de posts NÃO se repete aqui: ela é a Início (um feed só, um desenho só); daqui há só o atalho para lá.
 * O visor e o "criar" abrem por cima, com o endereço dizendo o que está aberto (?ver=nome&i=0, ?criar=1, ?destaque=id; o "@"
 * no ?ver=@nome também vale). É o destino do "Pôr no story" do cartão. Atrás das flags rede-v2 + alumia-2 + alumia-stories
 * (lib/rede/rotas-novas.ts): desligadas, a página dá 404.
 */
export default function TelaDeStories({ lang, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDosStories(lang);

  return (
    <section className="al3-tela al-st-pagina" aria-labelledby="al-st-pagina-titulo">
      <header className="al-st-pagina-cabeca">
        <h1 id="al-st-pagina-titulo" className="al3-cond al3-titulo-tela">
          {t?.pagina.titulo ?? "Stories"}
        </h1>
        {t ? <p className="al-st-pagina-lede">{t.pagina.lede}</p> : null}
      </header>
      <StoriesNoAlto lang={lang} situacao={situacao} />
      {/* Os meus destaques (os mesmos do perfil): numa linha recolhível, para abrir e arrumar sem sair dos stories. */}
      <DestaquesDoPerfil lang={lang} situacao={situacao} handle={situacao.handle ?? "voce"} compacto />
      {t ? (
        <p className="al-st-pagina-pe">
          <Link href={localePath(lang, "/alumia")} className="al-st-pagina-link">
            {t.pagina.inicio}
            <span aria-hidden> →</span>
          </Link>
        </p>
      ) : null}
    </section>
  );
}
