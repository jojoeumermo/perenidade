// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { celulasDaColagem, MODELOS_DE_COLAGEM, montarColagem, type ModeloDeColagem } from "@/lib/rede/stories/colagem";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import { CORES_DO_STORY, type CorDoStory } from "@/lib/rede/tipos-stories";
import { preencherStory } from "./usar";

type T = TextosDosStories["p5"]["colagem"];
const ACEITAS = "image/jpeg,image/png,image/webp";

/**
 * A colagem de fotos (P5, A16): o modelo (duas em cima e embaixo, duas lado a lado, três ou quatro), uma foto por célula e a cor da
 * faixa entre elas. "Usar a colagem" redesenha tudo num canvas (lib/rede/stories/colagem.ts): sai uma imagem só, sem o metadado das
 * fotos, que entra no quadro como a foto dele.
 */
export function Colagem({ t, aoUsar, aoCancelar }: { t: T; aoUsar: (imagem: Blob) => void; aoCancelar: () => void }) {
  const [modelo, setModelo] = useState<ModeloDeColagem>("dupla");
  const [fotos, setFotos] = useState<(Blob | null)[]>([null, null, null, null]);
  const [previas, setPrevias] = useState<(string | null)[]>([null, null, null, null]);
  const [cor, setCor] = useState<CorDoStory>("noite");
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alvo, setAlvo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const id = useId();

  const celulas = celulasDaColagem(modelo);
  const n = celulas.length;
  // Solta os endereços locais das prévias ao sair.
  const criadas = useRef(new Set<string>());
  useEffect(() => {
    const lista = criadas.current;
    return () => lista.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  useEffect(() => {
    raiz.current?.querySelector<HTMLElement>("button")?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      aoCancelar();
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [aoCancelar]);

  function escolher(k: number) {
    setAlvo(k);
    entrada.current?.click();
  }
  function aoArquivo(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);
    setFotos((l) => l.map((x, i) => (i === alvo ? arquivo : x)));
    const nova = URL.createObjectURL(arquivo);
    criadas.current.add(nova);
    setPrevias((l) => l.map((x, i) => (i === alvo ? nova : x)));
  }
  async function usar() {
    const escolhidas = fotos.slice(0, n);
    if (escolhidas.some((f) => !f)) return setErro(t.falta);
    setMontando(true);
    try {
      aoUsar(await montarColagem(escolhidas as Blob[], modelo, PALETA_DO_STORY[cor].fundo));
    } catch {
      setErro(t.falta);
      setMontando(false);
    }
  }

  return (
    <div ref={raiz} className="al-st-colagem" role="dialog" aria-modal="true" aria-labelledby={`${id}-t`}>
      <div className="al-st-colagem-caixa">
        <h2 id={`${id}-t`} className="al-cond al-st-titulo-secao">
          {t.titulo}
        </h2>
        <div className="al-ed-alvo al-st-colagem-modelos" role="radiogroup" aria-label={t.modelo}>
          {MODELOS_DE_COLAGEM.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={modelo === m} className="al-ed-alvo-op" onClick={() => setModelo(m)} title={t.modelos[m]}>
              <span className="al-st-colagem-icone" aria-hidden data-modelo={m}>
                {celulasDaColagem(m).map((c, k) => (
                  <i key={k} style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.l * 100}%`, height: `${c.a * 100}%` }} />
                ))}
              </span>
              <span className="sr-only">{t.modelos[m]}</span>
            </button>
          ))}
        </div>
        <div className="al-st-colagem-tela" style={{ background: PALETA_DO_STORY[cor].fundo }}>
          {celulas.map((c, k) => (
            <button
              key={`${modelo}-${k}`}
              type="button"
              className="al-st-colagem-celula"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.l * 100}%`, height: `${c.a * 100}%` }}
              aria-label={preencherStory(previas[k] ? t.trocar : t.escolher, { n: k + 1 })}
              onClick={() => escolher(k)}
            >
              {previas[k] ? (
                // Endereço local do próprio aparelho (blob:), só a prévia: o que sai é a colagem redesenhada.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previas[k] as string} alt="" draggable={false} />
              ) : (
                <span aria-hidden>+</span>
              )}
            </button>
          ))}
        </div>
        <fieldset className="al-st-cores" role="radiogroup">
          <legend>{t.fundo}</legend>
          {CORES_DO_STORY.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={c} className="al-st-cor" style={{ background: PALETA_DO_STORY[c].fundo }} onClick={() => setCor(c)} />
          ))}
        </fieldset>
        <p className="al-st-dica">{t.ajuda}</p>
        {erro ? (
          <p className="al-st-erro-criar" role="alert">
            {erro}
          </p>
        ) : null}
        <input
          ref={entrada}
          type="file"
          accept={ACEITAS}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            aoArquivo(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="al-st-caixa-acoes">
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={aoCancelar}>
            {t.cancelar}
          </button>
          <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={montando} aria-busy={montando} onClick={() => void usar()}>
            {montando ? t.lendo : t.usar}
          </button>
        </div>
      </div>
    </div>
  );
}
