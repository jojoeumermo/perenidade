// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { askAssistant, type AssistantRequest, useMe } from "@/lib/backend";
import { imageForAssistant } from "@/lib/upload";
import { L, useI18n } from "./I18n";

// O Markdown (com fórmulas) só é baixado quando chega a primeira resposta.
const Markdown = dynamic(() => import("./Markdown").then((m) => m.Markdown), { ssr: false });

type S = Dict["tutoring"]["assistant"];

/** A resposta do assistente, sempre com o aviso de que é automática e pode errar. */
export function RespostaDoAssistente({ texto, cortada, rotulo, aviso, avisoCortada, lang }: { texto: string; cortada: boolean; rotulo: string; aviso: string; avisoCortada: string; lang: string }) {
  return (
    <section aria-label={rotulo} className="mt-4 border-l-4 border-gold bg-parchment-deep px-4 py-3">
      <p className="font-mono text-xs uppercase tracking-widest text-ink-soft">{rotulo}</p>
      <div className="mt-2 font-serif text-base">
        <Markdown lang={lang}>{texto}</Markdown>
      </div>
      {cortada && <p className="mt-2 text-ink-soft">{avisoCortada}</p>}
      <p className="mt-3 text-xs text-ink-soft">{aviso}</p>
    </section>
  );
}

/**
 * "Sem voluntário agora? Pergunte ao assistente." Só aparece com o assistente ligado; usa a dúvida já escrita no
 * formulário do reforço, e o aviso de para onde ela vai fica à vista ANTES do botão.
 */
export function Assistente({ s, disciplina, pergunta, aulas }: { s: S; disciplina: string; pergunta: string; aulas: AssistantRequest["aulas"] }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [foto, setFoto] = useState<{ tipo: string; dados: string; nome: string } | null>(null);
  const [estado, setEstado] = useState<{ fase: "parado" | "pensando" } | { fase: "resposta"; texto: string; cortada: boolean; restantes: number | null } | { fase: "erro"; texto: string }>({ fase: "parado" });
  const arquivo = useRef<HTMLInputElement>(null);
  const pronto = pergunta.trim().length >= 10 || foto !== null;

  async function escolher(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    try {
      setFoto({ ...(await imageForAssistant(escolhido)), nome: escolhido.name });
    } catch {
      setEstado({ fase: "erro", texto: errorText(t, "imagem") });
    }
  }

  async function perguntar() {
    setEstado({ fase: "pensando" });
    const r = await askAssistant({ modo: "pergunta", pergunta: pergunta.trim(), disciplina, idioma: lang, aulas, ...(foto ? { imagem: { tipo: foto.tipo, dados: foto.dados } } : {}) });
    if (r.ok) setEstado({ fase: "resposta", texto: r.texto, cortada: r.cortada, restantes: r.restantes });
    else setEstado({ fase: "erro", texto: r.recusa ? s.refused : errorText(t, r.erro) });
  }

  return (
    <section className="border-2 border-ink p-4" aria-labelledby="assistente-titulo">
      <h2 id="assistente-titulo" className="font-serif text-2xl font-semibold">{s.title}</h2>
      <p className="mt-1">{s.lead}</p>
      <p className="mt-3 border-l-4 border-oxblood pl-3 text-ink-soft">{s.warning}</p>
      {me.status !== "in" ? (
        <p className="mt-3">
          {s.login}{" "}
          <L href="/entrar" className="font-semibold underline hover:text-oxblood">{s.loginLink}</L>
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer border border-rule bg-parchment-deep px-3 py-1.5 hover:border-ink focus-within:outline focus-within:outline-2">
              {s.photo}
              <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => escolher(e.target.files)} />
            </label>
            {foto && (
              <span className="flex items-center gap-2 text-ink-soft">
                {foto.nome}
                <button
                  type="button"
                  className="cursor-pointer underline hover:text-oxblood"
                  onClick={() => {
                    setFoto(null);
                    if (arquivo.current) arquivo.current.value = "";
                  }}
                >
                  {s.removePhoto}
                </button>
              </span>
            )}
          </div>
          <p className="mt-3">
            <button type="button" disabled={!pronto || estado.fase === "pensando"} onClick={perguntar} className="cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
              {s.ask}
            </button>
            {!pronto && <span className="ml-3 text-ink-soft">{s.need}</span>}
          </p>
        </>
      )}
      <div role="status" aria-live="polite">
        {estado.fase === "pensando" && <p className="mt-3 text-ink-soft">{s.asking}</p>}
        {estado.fase === "erro" && <p className="mt-3 text-oxblood">{estado.texto}</p>}
      </div>
      {estado.fase === "resposta" && (
        <>
          <RespostaDoAssistente texto={estado.texto} cortada={estado.cortada} rotulo={s.answer} aviso={s.mayErr} avisoCortada={s.cut} lang={lang} />
          {estado.restantes !== null && <p className="mt-2 text-xs text-ink-soft">{fill(s.left, { n: estado.restantes })}</p>}
          <p className="mt-3 font-semibold">{s.toVolunteer}</p>
        </>
      )}
    </section>
  );
}
