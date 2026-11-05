// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowLeft, ArrowRight, CircleHelp, Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GUIAS } from "./guias";
import { Botao, Dialogo } from "./ui";

const VISTAS = "lucia:guias-vistos";
/** A pessoa pediu para as seções não oferecerem mais o passo a passo na primeira visita (o botão continua). */
const SEM_CONVITE = "lucia:guias-sem-convite";

function vistos(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(VISTAS) ?? "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
/** Sem convite se a pessoa pediu, e enquanto o passeio do painel (components/painel/Tutorial.tsx) não foi visto: uma ajuda de cada vez. */
function semConvite() {
  try {
    return localStorage.getItem(SEM_CONVITE) === "1" || !localStorage.getItem("lucia:tutorial-painel");
  } catch {
    return true;
  }
}
export function marcarVisto(id: string) {
  try {
    localStorage.setItem(VISTAS, JSON.stringify([...new Set([...vistos(), id])]));
  } catch {
    // sem armazenamento
  }
}

/**
 * O passo a passo de cada seção do painel (components/painel/guias.ts). Fica no cabeçalho da casca como um botão
 * discreto que abre um painel (Dialogo: foco preso, Esc fecha). Na primeira vez que a pessoa abre uma seção, aparece
 * um balão convidando para ver como ela funciona; o botão reabre a qualquer hora. Os passos vão um de cada vez, em
 * linguagem simples, com voltar e avançar (setas do teclado também).
 */
export function GuiaDaSecao({ id, nome }: { id: string; nome: string }) {
  const guia = GUIAS[id];
  const [aberto, setAberto] = useState(false);
  const [passo, setPasso] = useState(0);
  const [convite, setConvite] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o que já foi visto só existe no navegador
    setConvite(Boolean(guia) && !vistos().includes(id) && !semConvite());
  }, [id, guia]);

  useEffect(() => {
    if (!aberto || !guia) return;
    // Esc fica com o Dialogo; as setas andam pelos passos.
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPasso((p) => Math.min(p + 1, guia.passos.length - 1));
      else if (e.key === "ArrowLeft") setPasso((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  if (!guia) return null;
  const abrir = () => {
    setPasso(0);
    setAberto(true);
  };
  function fechar() {
    setAberto(false);
    setConvite(false);
    marcarVisto(id);
    window.setTimeout(() => botao.current?.focus(), 0);
  }
  const atual = guia.passos[passo];
  const ultimo = passo === guia.passos.length - 1;

  return (
    <>
      <Botao ref={botao} variante="discreto" pequeno simbolo={CircleHelp} onClick={abrir} data-tour="como-funciona" aria-haspopup="dialog" aria-expanded={aberto} className="no-print">
        Como funciona esta seção
      </Botao>

      {convite && !aberto && (
        <p role="status" className="pn-cartao pn-cartao-destaque no-print flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="pn-rotulo-mono w-full">Primeira vez aqui?</span>
          <span className="min-w-[min(100%,14rem)] flex-1 text-sm">{guia.paraQue} Veja como funciona em {guia.passos.length} passos.</span>
          <span className="flex w-full flex-wrap gap-1.5">
            <Botao variante="principal" pequeno onClick={abrir}>
              Ver o passo a passo
            </Botao>
            <Botao
              variante="discreto"
              pequeno
              onClick={() => {
                setConvite(false);
                marcarVisto(id);
              }}
            >
              Agora não
            </Botao>
            <Botao
              variante="discreto"
              pequeno
              onClick={() => {
                setConvite(false);
                marcarVisto(id);
                try {
                  localStorage.setItem(SEM_CONVITE, "1");
                } catch {
                  // sem armazenamento
                }
              }}
            >
              Não oferecer em outras seções
            </Botao>
          </span>
        </p>
      )}

      <Dialogo aberto={aberto} aoMudar={(a) => (a ? setAberto(true) : fechar())} titulo={atual.titulo}>
        <div className="no-print">
          <p className="pn-rotulo-mono mt-1">{`${nome} · passo ${passo + 1} de ${guia.passos.length}`}</p>
          {passo === 0 && <p className="pn-ajuda mt-2 text-[0.95rem] leading-snug">{guia.paraQue}</p>}
          <p className="mt-3 text-[1rem] leading-relaxed">{atual.texto}</p>
          {ultimo && guia.dica && (
            <p className="pn-cartao pn-cartao-plano mt-4 flex gap-2 text-[0.92rem] leading-snug">
              <Lightbulb aria-hidden width={16} height={16} className="mt-0.5 shrink-0 text-gold" />
              <span>
                <strong>Dica:</strong> {guia.dica}
              </span>
            </p>
          )}
          <div aria-hidden className="mt-5 flex gap-1.5">
            {guia.passos.map((_, i) => (
              <span key={i} className={`h-1 flex-1 rounded-full ${i <= passo ? "bg-oxblood" : "bg-rule"}`} />
            ))}
          </div>
          <div className="pn-dialogo-acoes justify-start">
            {passo > 0 && (
              <Botao simbolo={ArrowLeft} onClick={() => setPasso(passo - 1)}>
                Voltar
              </Botao>
            )}
            <Botao variante="principal" autoFocus simboloFim={ultimo ? undefined : ArrowRight} onClick={() => (ultimo ? fechar() : setPasso(passo + 1))}>
              {ultimo ? "Entendi" : "Próximo"}
            </Botao>
            <Botao variante="discreto" className="ml-auto" onClick={fechar}>
              Fechar
            </Botao>
          </div>
        </div>
      </Dialogo>
    </>
  );
}