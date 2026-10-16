// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { askAssistant, useAssistantOn, useMe } from "@/lib/backend";
import { resolver } from "@/lib/ferramentas/resolvedor";
import { imageForAssistant } from "@/lib/upload";
import { RespostaDoAssistente } from "../Assistente";
import { useI18n } from "../I18n";

type S = Dict["tools"]["solver"]["photo"];

/** A conta lida na foto é uma que o resolvedor daqui entende? Então dá para refazer passo a passo, sem depender da IA. */
function resolvivel(conta: string): boolean {
  if (!conta) return false;
  try {
    resolver(conta.replace(/²/g, "^2"), { complexas: false, metodo: "adicao" });
    return true;
  } catch {
    return false;
  }
}

/**
 * "Foto do exercício": o assistente lê a foto, transcreve o enunciado e explica a resolução. Só aparece para quem tem
 * conta e com o assistente ligado; o aviso de para onde a foto vai fica ao lado do botão, antes de escolher a imagem.
 */
export function FotoDoExercicio({ s, aoUsar }: { s: S; aoUsar: (conta: string) => void }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const ligado = useAssistantOn(me.status === "in");
  const [estado, setEstado] = useState<{ fase: "parado" | "lendo" } | { fase: "erro"; texto: string } | { fase: "lida"; transcricao: string; conta: string; texto: string; cortada: boolean; restantes: number | null }>({ fase: "parado" });
  if (!ligado || me.status !== "in") return null;

  async function enviar(lista: FileList | null) {
    const arquivo = lista?.[0];
    if (!arquivo) return;
    setEstado({ fase: "lendo" });
    let imagem;
    try {
      imagem = await imageForAssistant(arquivo);
    } catch {
      setEstado({ fase: "erro", texto: errorText(t, "imagem") });
      return;
    }
    const r = await askAssistant({ modo: "foto", pergunta: "", disciplina: "matematica", idioma: lang, aulas: [], imagem });
    if (r.ok) setEstado({ fase: "lida", transcricao: r.transcricao, conta: r.conta, texto: r.texto, cortada: r.cortada, restantes: r.restantes });
    else setEstado({ fase: "erro", texto: r.recusa ? s.refused : errorText(t, r.erro) });
  }

  return (
    <div className="mt-4 border-t border-rule pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className={`cursor-pointer border-2 border-ink px-4 py-2 font-medium hover:border-oxblood hover:text-oxblood focus-within:outline focus-within:outline-2 ${estado.fase === "lendo" ? "pointer-events-none opacity-50" : ""}`}>
          {s.button}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" aria-label={s.label} disabled={estado.fase === "lendo"} onChange={(e) => { void enviar(e.target.files); e.target.value = ""; }} />
        </label>
        <p className="min-w-0 flex-1 text-xs text-ink-soft">{s.warning}</p>
      </div>
      <div role="status" aria-live="polite">
        {estado.fase === "lendo" && <p className="mt-3 text-ink-soft">{s.reading}</p>}
        {estado.fase === "erro" && <p className="mt-3 text-oxblood">{estado.texto}</p>}
      </div>
      {estado.fase === "lida" && (
        <div className="mt-3">
          {estado.transcricao && (
            <div className="border border-rule bg-parchment-deep p-3">
              <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{s.read}</p>
              <p className="mt-1 whitespace-pre-wrap">{estado.transcricao}</p>
              {resolvivel(estado.conta) && (
                <p className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-mono text-base">{estado.conta}</span>
                  <button type="button" className="cursor-pointer bg-ink px-4 py-1.5 font-medium text-parchment hover:bg-oxblood" onClick={() => aoUsar(estado.conta)}>
                    {s.solveHere}
                  </button>
                </p>
              )}
            </div>
          )}
          <RespostaDoAssistente texto={estado.texto} cortada={estado.cortada} rotulo={s.explanation} aviso={s.mayErr} avisoCortada={s.cut} lang={lang} />
          {estado.restantes !== null && <p className="mt-2 text-xs text-ink-soft">{fill(s.left, { n: estado.restantes })}</p>}
        </div>
      )}
    </div>
  );
}
