// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/I18n";
import { errorText } from "@/i18n/core";
import type { TextosDoAcompanhante } from "@/i18n/escola/acompanhante";
import type { TextosDosAgentes } from "@/i18n/escola/agentes";
import { LIMITES_DOS_AGENTES } from "@/lib/escola/agentes";
import { imageForAssistant } from "@/lib/upload";
import { Conversa } from "../acompanhante/Conversa";
import { type ImagemRiscada, Tarja } from "../acompanhante/Tarja";
import { conferirComTextos } from "./conferir";

/** Os endereços que já estão no conteúdo do site (content/direitos.json). O Procon fica sem link até a coordenação indicar um. */
const DEFENSORIA = "https://www.dpu.def.br/";
const MEU_INSS = "https://meu.inss.gov.br/";

/**
 * Ajudante de papelada (modo "papelada" do assistente): lista e explica os campos de um formulário EM BRANCO, em foto
 * riscada (a mesma Tarja do "Entender um documento") ou em texto colado. Não preenche nada. A foto só pode ser escolhida
 * depois do "Li o aviso". Isto não é orientação jurídica.
 */
export function Papelada({ s, comum, a }: { s: TextosDosAgentes["papelada"]; comum: TextosDosAgentes["comum"]; a: TextosDoAcompanhante }) {
  const { t, lang } = useI18n();
  const id = useId();
  const arquivo = useRef<HTMLInputElement>(null);
  const [caminho, setCaminho] = useState<"foto" | "texto">("foto");
  const [entendeu, setEntendeu] = useState(false);
  const [foto, setFoto] = useState<ImagemRiscada | null>(null);
  const [riscada, setRiscada] = useState<{ imagem: ImagemRiscada | null; tarjas: number } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const conferir = useMemo(() => conferirComTextos(comum), [comum]);

  async function escolher(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    setErro("");
    setPreparando(true);
    setRiscada(null);
    try {
      setFoto(await imageForAssistant(escolhido));
      setVersao((v) => v + 1);
    } catch {
      setFoto(null);
      setErro(errorText(t, "imagem"));
    } finally {
      setPreparando(false);
      // O nome do arquivo não fica em lugar nenhum: o campo é limpo.
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  const aba = (chave: "foto" | "texto", rotulo: string) => (
    <button type="button" role="tab" aria-selected={caminho === chave} className={caminho === chave ? "acompanhante-botao" : "acompanhante-botao-claro"} onClick={() => setCaminho(chave)} data-caminho={chave}>
      {rotulo}
    </button>
  );

  return (
    <div data-papelada>
      <section className="border-2 border-oxblood p-4" aria-labelledby={`${id}-aviso`}>
        <h2 id={`${id}-aviso`} className="font-serif text-2xl font-semibold">
          {s.avisoTitulo}
        </h2>
        <p className="mt-2 font-semibold">{s.aviso}</p>
        <p className="mt-2 text-sm">{comum.naoEscreva}</p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={entendeu} onChange={(e) => setEntendeu(e.target.checked)} className="h-5 w-5 shrink-0" data-entendi-papelada />
          <span>{s.entendi}</span>
        </label>
      </section>

      <div role="tablist" className="mt-6 flex flex-wrap gap-2">
        {aba("foto", s.caminhoFoto)}
        {aba("texto", s.caminhoTexto)}
      </div>

      {caminho === "foto" && entendeu && (
        <section className="mt-4">
          <label className="acompanhante-botao-claro cursor-pointer focus-within:outline focus-within:outline-2">
            {foto ? s.trocar : s.escolher}
            <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => void escolher(e.target.files)} data-foto-papelada />
          </label>
          <div role="status" aria-live="polite">
            {preparando && <p className="mt-2 text-ink-soft">{s.preparando}</p>}
            {erro && <p className="mt-2 text-oxblood">{erro}</p>}
          </div>
          {foto && <Tarja s={a.tarja} foto={foto} aoMudar={(imagem, tarjas) => setRiscada({ imagem, tarjas })} />}
          {foto && riscada && riscada.tarjas === 0 && <p className="mt-2 text-sm text-ink-soft">{s.semTarja}</p>}
          {foto && (
            <div className="mt-6">
              <Conversa
                key={versao}
                s={a}
                modo="papelada"
                imagem={riscada?.imagem ?? null}
                itens={["foto", "pergunta"]}
                campo={{ rotulo: s.pergunta, max: 600, min: 3, linhas: 2, lang }}
                botao={s.botaoFoto}
                semTextoBasta
                umaVez
                semServidor="aviso"
                avisoDaResposta={s.naoJuridica}
                conferirTexto={conferir}
              />
            </div>
          )}
        </section>
      )}

      {caminho === "texto" && (
        <section className="mt-4">
          <Conversa
            s={a}
            modo="papelada"
            itens={["formulario"]}
            campo={{ rotulo: s.texto, dica: s.textoDica, max: LIMITES_DOS_AGENTES.papeladaMax, min: LIMITES_DOS_AGENTES.papeladaMin, linhas: 8, lang }}
            botao={s.botaoTexto}
            umaVez
            semServidor="aviso"
            avisoDaResposta={s.naoJuridica}
            bloqueado={!entendeu}
            conferirTexto={conferir}
          />
        </section>
      )}

      <section className="mt-8 border-l-4 border-gold pl-3 text-sm" aria-label={s.ajuda}>
        <p>{s.naoJuridica}</p>
        <p className="mt-2 font-semibold">{s.ajuda}</p>
        <ul className="mt-1 list-disc pl-5">
          <li>
            <a href={DEFENSORIA} target="_blank" rel="noreferrer" className="underline hover:text-oxblood">
              {s.defensoria}
            </a>
          </li>
          <li>{s.procon}</li>
          <li>
            <a href={MEU_INSS} target="_blank" rel="noreferrer" className="underline hover:text-oxblood">
              {s.meuInss}
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
