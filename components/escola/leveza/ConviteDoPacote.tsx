// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import type { MotivoDoConvite, Resposta } from "@/lib/escola/leveza";
import { setPrefs } from "@/lib/prefs";

const TEXTO: Record<MotivoDoConvite, "textoPacoteAcaba" | "textoEconomia" | "textoRedeLenta"> = {
  "pacote-acaba": "textoPacoteAcaba",
  "economia-do-aparelho": "textoEconomia",
  "rede-lenta": "textoRedeLenta",
};

/** A faixa do convite: três botões do mesmo tamanho e peso, sem contagem e sem roubar o foco. */
export function ConviteDoPacote({ s, motivo, responder }: { s: TextosDaLeveza["convite"]; motivo: MotivoDoConvite; responder: (r: Resposta) => void }) {
  return (
    <section role="region" aria-label={s.rotulo} className="lev-convite no-print">
      <h2 className="lev-titulo">{s.titulo}</h2>
      <p>{s[TEXTO[motivo]]}</p>
      <div className="lev-botoes">
        <button
          type="button"
          className="lev-botao"
          onClick={() => {
            setPrefs({ pacote: true });
            responder("aceito");
          }}
        >
          {s.ligar}
        </button>
        <button type="button" className="lev-botao" onClick={() => responder("depois")}>
          {s.agora}
        </button>
        <button type="button" className="lev-botao" onClick={() => responder("nunca")}>
          {s.nunca}
        </button>
      </div>
      <p className="lev-nota">{s.aviso}</p>
    </section>
  );
}
