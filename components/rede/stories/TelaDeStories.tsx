// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useState } from "react";
import type { Aba } from "@/lib/rede/tipos";
import { Linha } from "../Linha";
import type { PropsDaTelaDoPacote } from "../registro";
import { DestaquesDoPerfil } from "./Destaques";
import StoriesNoAlto from "./NoAlto";
import { focarNoGrupo, indiceDaSeta, useTextosDosStories } from "./usar";

const ABAS: readonly ("seguindo" | "comunidades" | "tudo")[] = ["seguindo", "comunidades", "tudo"];

/**
 * Os stories (/alumia/stories; pranchas celular-stories-na-linha, celular-criar-story e celular-ver-story): a faixa no alto
 * (a mesma do alto da linha de Início, components/rede/stories/NoAlto.tsx), as abas Seguindo / Comunidades / Tudo e a linha de
 * sempre embaixo; o visor e o "criar" abrem por cima, com o endereço dizendo o que está aberto (?ver=nome&i=0, ?criar=1,
 * ?destaque=id; o "@" no ?ver=@nome também vale). É o
 * destino do "Pôr no story" do cartão. Atrás das flags rede-v2 + alumia-2 + alumia-stories (lib/rede/rotas-novas.ts):
 * desligadas, a página dá 404.
 */
export default function TelaDeStories({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDosStories(lang);
  const [aba, setAba] = useState<Aba>("seguindo");
  // A prancha diz só "Comunidades" (o rótulo curto do menu), não "Minhas comunidades".
  const rotulo = (a: (typeof ABAS)[number]) => (a === "comunidades" ? s.menu.comunidades : s.abas[a]);

  return (
    <div>
      <StoriesNoAlto lang={lang} situacao={situacao} />
      {/* Os meus destaques (os mesmos do perfil; a prancha os põe no perfil): aqui só numa linha recolhível, fechada de início,
          para abrir e arrumar sem sair dos stories e sem empurrar a linha para baixo. */}
      <DestaquesDoPerfil lang={lang} situacao={situacao} handle={situacao.handle ?? "voce"} compacto />

      <div className="al-st-abas" role="tablist" aria-label={t?.abas.rotulo ?? s.abas.rotulo}>
        {ABAS.map((a, k) => (
          <button
            key={a}
            type="button"
            role="tab"
            id={`al-st-aba-${a}`}
            aria-controls="al-st-aba-painel"
            aria-selected={aba === a}
            tabIndex={aba === a ? 0 : -1}
            className="al-st-aba"
            onClick={() => setAba(a)}
            onKeyDown={(e) => {
              const n = indiceDaSeta(e.key, k, ABAS.length, "horizontal");
              if (n === null) return;
              e.preventDefault();
              setAba(ABAS[n]);
              focarNoGrupo(e.currentTarget, "[role=tab]", n);
            }}
          >
            {rotulo(a)}
          </button>
        ))}
      </div>
      <div id="al-st-aba-painel" role="tabpanel" aria-labelledby={`al-st-aba-${aba}`} className="al-st-aba-painel">
        <Linha key={aba} aba={aba} lang={lang} s={s} logado={situacao.logado} vazio={aba === "seguindo" ? s.estados.vazioSeguindo : aba === "comunidades" ? s.estados.vazioComunidades : undefined} />
      </div>
    </div>
  );
}
