// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import { preencherTexto as preencher } from "@/lib/escola/leveza";
import { setPrefs, usePrefs } from "@/lib/prefs";

/** Dois interruptores: o modo pacote de dados e "Só o texto". Anunciam a mudança em aria-live. */
export function InterruptoresDeLeveza({ s, soTexto, definirSoTexto }: { s: TextosDaLeveza["leve"]; soTexto: boolean; definirSoTexto: (ligado: boolean) => void }) {
  const prefs = usePrefs();
  const [aviso, setAviso] = useState("");
  const [ofereceLeve, setOfereceLeve] = useState(false);

  const anunciar = (nome: string, ligado: boolean) => setAviso(preencher(ligado ? s.ligou : s.desligou, { nome }));

  return (
    <div className="lev-interruptores">
      <div className="lev-linha">
        <button
          type="button"
          role="switch"
          aria-checked={prefs.pacote}
          aria-describedby="lev-pacote-dica"
          className="lev-interruptor"
          onClick={() => {
            const ligar = !prefs.pacote;
            setOfereceLeve(!ligar && prefs.light);
            setPrefs({ pacote: ligar });
            anunciar(s.pacote, ligar);
          }}
        >
          <span className="lev-chave" aria-hidden="true" />
          {s.pacote}
        </button>
        <p id="lev-pacote-dica" className="lev-nota">
          {s.pacoteDica}
        </p>
        {ofereceLeve && !prefs.pacote && prefs.light && (
          <button
            type="button"
            className="lev-botao"
            onClick={() => {
              setPrefs({ light: false });
              setOfereceLeve(false);
            }}
          >
            {s.desligarLeve}
          </button>
        )}
      </div>
      <div className="lev-linha">
        <button
          type="button"
          role="switch"
          aria-checked={soTexto}
          aria-describedby="lev-sotexto-dica"
          className="lev-interruptor"
          onClick={() => {
            definirSoTexto(!soTexto);
            anunciar(s.soTexto, !soTexto);
          }}
        >
          <span className="lev-chave" aria-hidden="true" />
          {s.soTexto}
        </button>
        <p id="lev-sotexto-dica" className="lev-nota">
          {s.soTextoDica}
        </p>
      </div>
      <p className="lev-nota">{s.nota}</p>
      <p role="status" aria-live="polite" className="lev-anuncio">
        {aviso}
      </p>
    </div>
  );
}
