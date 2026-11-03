// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { type EstadoDoAgir, guardarAgir, lerAgir } from "@/lib/agir";
import { L, useI18n } from "../I18n";
import { TextoSimples } from "./Blocos";

/**
 * "Como foi?": no começo da aula seguinte, pergunta como foi a tarefa do "Agir" da aula anterior da trilha. A resposta
 * (fiz, fiz em parte, ainda não, e uma nota se a pessoa quiser) fica só no aparelho, em "lucia:agir:<trilha>/<aula>";
 * nada é enviado e ninguém é contado. Sem armazenamento, a resposta vale só enquanto a página está aberta.
 */
export function ComoFoi({ anterior, titulo, tarefa, href }: { anterior: string; titulo: string; tarefa: string; href: string }) {
  const { t } = useI18n();
  const b = t.lesson.blocks;
  const [estado, setEstado] = useState<EstadoDoAgir | null>(null);
  const [nota, setNota] = useState("");
  const [mudando, setMudando] = useState(false);
  useEffect(() => {
    const r = lerAgir(anterior);
    if (!r) return;
    /* eslint-disable react-hooks/set-state-in-effect -- o registro só existe no navegador */
    setEstado(r.estado);
    setNota(r.nota ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [anterior]);

  const responder = (novo: EstadoDoAgir) => {
    setEstado(novo);
    setMudando(false);
    guardarAgir(anterior, { estado: novo, nota });
  };
  const resposta = estado === "fiz" ? b.comoFoiRespFiz : estado === "em-parte" ? b.comoFoiRespParte : estado === "nao" ? b.comoFoiRespNao : "";
  const respondida = estado !== null && estado !== "vou" && !mudando;
  const botao = "cursor-pointer border-2 border-ink bg-parchment px-3 py-2 font-bold text-ink hover:border-oxblood hover:text-oxblood";

  return (
    <aside className="bloco bloco-comofoi no-print mt-6 border-2 border-ink bg-parchment-deep p-4 font-sans text-sm" aria-labelledby="como-foi-titulo">
      <p id="como-foi-titulo" className="font-mono text-xs uppercase tracking-[0.1em] text-oxblood">{b.comoFoiTitulo}</p>
      <p className="mt-2 text-ink-soft">{fill(b.comoFoiIntro, { aula: titulo })}</p>
      <TextoSimples texto={tarefa.replace(/^#\s+.*\n?/, "")} className="mt-1 font-serif text-base" />
      {respondida ? (
        <div className="mt-3">
          <p role="status" className="font-bold">{resposta}</p>
          {estado === "nao" && (
            <p className="mt-1">
              <L href={href}>{b.comoFoiVer} →</L>
            </p>
          )}
          <button type="button" className="mt-2 cursor-pointer underline hover:text-oxblood" onClick={() => setMudando(true)}>{b.comoFoiMudar}</button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={botao} onClick={() => responder("fiz")}>{b.comoFoiFiz}</button>
            <button type="button" className={botao} onClick={() => responder("em-parte")}>{b.comoFoiParte}</button>
            <button type="button" className={botao} onClick={() => responder("nao")}>{b.comoFoiNao}</button>
          </div>
          <label className="mt-3 block text-ink-soft">
            {b.comoFoiNota}
            <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} maxLength={2000} className="bloco-campo" />
          </label>
        </div>
      )}
    </aside>
  );
}
