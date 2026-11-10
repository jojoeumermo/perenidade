// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Chegar" (prancha celular-modo-atos): abre uma folha (popover nativo, com Esc e toque fora para fechar) com três jeitos de ir ao
// ponto PÚBLICO do ato: o app de mapas do próprio celular (link geo:, RFC 5870), o OpenStreetMap (livre, sem conta) e copiar o
// endereço. A Alumia não pede a posição do aparelho, não guarda que a pessoa abriu o mapa e o link sai sem Referer (§6.7).
import { useEffect, useId, useState, type ReactNode } from "react";
import { enderecoDoMapa, linkDoMapa, linkGeo } from "@/lib/rede/atos/chegar";
import { pontoEDetalhe } from "@/lib/rede/atos/formulario";
import type { TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Ato } from "@/lib/rede/tipos-atos";
import { Icone } from "./partes";

/** O celular tem um app de mapas que entende geo:? (toque como ponteiro principal). */
function useCelular(): boolean {
  const [sim, setSim] = useState(false);
  useEffect(() => {
    try {
      const m = window.matchMedia("(pointer: coarse)");
      queueMicrotask(() => setSim(m.matches));
    } catch {
      // sem matchMedia: fica o OpenStreetMap
    }
  }, []);
  return sim;
}

/**
 * O botão do Chegar e a folha. `gatilho` desenha o botão (o quadrado da coluna ou um botão comum); a folha é a mesma.
 */
export function Chegar({ ato, t, gatilho }: { ato: Ato; t: TextosDosAtos; gatilho: (props: { popoverTarget: string; "aria-haspopup": "dialog" }) => ReactNode }) {
  const id = useId().replace(/:/g, "");
  const folha = `al-chegar-folha-${id}`;
  const celular = useCelular();
  const [copiado, setCopiado] = useState(false);
  const { ponto } = pontoEDetalhe(ato.onde);
  const endereco = enderecoDoMapa(ponto, ato.cidade);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(endereco);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 3500);
    } catch {
      setCopiado(false);
    }
  };
  return (
    <>
      {gatilho({ popoverTarget: folha, "aria-haspopup": "dialog" })}
      <div id={folha} popover="auto" className="al-chegar-folha" role="dialog" aria-labelledby={`${folha}-t`}>
        <div className="al-chegar-cabeca">
          <h2 id={`${folha}-t`} className="al-cond">
            {t.acoes.chegarTitulo}
          </h2>
          <button type="button" className="al-chegar-fechar" popoverTarget={folha} popoverTargetAction="hide" aria-label={t.acoes.fechar}>
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="al-chegar-endereco">
          {Icone.pino(18)} <span>{endereco}</span>
        </p>
        <div className="al-chegar-opcoes">
          {celular ? (
            <a className="al-chegar-opcao" href={linkGeo(ponto, ato.cidade)} rel="noopener noreferrer" referrerPolicy="no-referrer">
              {Icone.pino(20)}
              {t.acoes.chegarApp}
            </a>
          ) : null}
          <a className="al-chegar-opcao" href={linkDoMapa(ponto, ato.cidade)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            {Icone.fora(20)}
            {t.acoes.chegarOsm}
          </a>
          <button type="button" className="al-chegar-opcao" onClick={() => void copiar()}>
            {Icone.copiar(20)}
            {t.acoes.chegarCopiar}
          </button>
        </div>
        <p className="al-chegar-explica">{t.acoes.chegarExplica}</p>
        <p role="status" className="al-ato-copiado">
          {copiado ? t.acoes.enderecoCopiado : ""}
        </p>
      </div>
    </>
  );
}
