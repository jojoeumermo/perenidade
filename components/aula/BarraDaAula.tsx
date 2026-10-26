// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useRef, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { speechSupported, startReading, stopReading, useSpeaking } from "@/lib/speech";
import { useI18n } from "../I18n";
import { ABRIR_CAIXA } from "./MargemDaAula";

const LARGURA = "lucia:aula-largura";
export const ANOTAR = "lucia:anotar";

type Modo = "normal" | "larga" | "foco";

// O "Ouvir" lê só a aula: título, resumo e texto (sem menus, margem, exercícios nem rodapé).
export const TRECHOS_DA_AULA = [".folha-da-aula h1", ".folha-da-aula h1 + p", "#texto-da-aula"];

function aplicar(modo: Modo) {
  const raiz = document.documentElement;
  raiz.toggleAttribute("data-aula-larga", modo === "larga");
  raiz.toggleAttribute("data-aula-foco", modo === "foco");
}

/** Conta "abriu" e "terminou" (só o total do dia por aula, sem identificar ninguém), uma vez por aparelho e por dia. */
function contarUmaVez(tipo: "aula_abriu" | "aula_terminou", alvo: string) {
  if (!hasBackend) return;
  const chave = `lucia:${tipo}:${alvo}`;
  const hoje = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(chave) === hoje) return;
    localStorage.setItem(chave, hoje);
  } catch {
    // sem armazenamento: conta assim mesmo
  }
  void rpc("contar", { p_tipo: tipo, p_alvo: alvo }).catch(() => {});
}

/**
 * A faixa preta no alto da aula: de que trilha ela é, em que aula a pessoa está, quanto já leu (o fio vermelho cresce
 * com a rolagem do texto) e os botões de ouvir, anotar, alargar o texto e o modo foco, que tira da tela tudo o que não
 * é a aula. A escolha da largura fica guardada no aparelho.
 */
export function BarraDaAula({ voltar, trilha, posicao, minutos, aula, ferramentas }: { voltar: string; trilha: string; posicao: string; minutos: string; aula: string; ferramentas: string }) {
  const { t } = useI18n();
  const l = t.lesson;
  const falando = useSpeaking();
  const [lido, setLido] = useState(0);
  const [modo, setModo] = useState<Modo>("normal");
  const [podeOuvir, setPodeOuvir] = useState(false);
  const terminou = useRef(false);

  useEffect(() => {
    let guardado: Modo = "normal";
    try {
      const v = localStorage.getItem(LARGURA);
      if (v === "larga" || v === "foco") guardado = v;
    } catch {
      // sem armazenamento
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a escolha só existe no navegador
    setModo(guardado);
    setPodeOuvir(speechSupported());
    aplicar(guardado);
    contarUmaVez("aula_abriu", aula);
    return () => aplicar("normal");
  }, [aula]);

  useEffect(() => {
    const texto = document.getElementById("texto-da-aula");
    if (!texto) return;
    let esperando = false;
    const medir = () => {
      esperando = false;
      const caixa = texto.getBoundingClientRect();
      const total = caixa.height - window.innerHeight * 0.6;
      const feito = total > 0 ? Math.min(1, Math.max(0, -caixa.top / total)) : 1;
      setLido(Math.round(feito * 100));
      if (feito > 0.95 && !terminou.current) {
        terminou.current = true;
        contarUmaVez("aula_terminou", aula);
      }
    };
    const rolar = () => {
      if (esperando) return;
      esperando = true;
      requestAnimationFrame(medir);
    };
    medir();
    window.addEventListener("scroll", rolar, { passive: true });
    window.addEventListener("resize", rolar);
    return () => {
      window.removeEventListener("scroll", rolar);
      window.removeEventListener("resize", rolar);
    };
  }, [aula]);

  const escolher = (novo: Modo) => {
    setModo(novo);
    aplicar(novo);
    try {
      localStorage.setItem(LARGURA, novo);
    } catch {
      // sem armazenamento: vale até fechar a página
    }
  };

  const botao = "cursor-pointer whitespace-nowrap border border-transparent px-2 py-1 text-[#e9dcbc] hover:border-[#e9dcbc] hover:text-white aria-pressed:border-[#e9dcbc] aria-pressed:bg-[#e9dcbc] aria-pressed:text-[#1f1a14]";

  return (
    <div className="faixa-da-aula no-print no-focus sticky top-[var(--altura-topo,0px)] z-30 bg-[#1f1a14] text-[#e9dcbc] app:max-md:hidden">
      <div className="mx-auto flex max-w-[86rem] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 font-mono text-xs uppercase tracking-[0.08em] sm:px-6 lg:px-8">
        <Link href={voltar} className="max-w-[16rem] truncate text-[#f4ecd8] hover:text-white">
          ← {trilha}
        </Link>
        <span className="text-[#b3a584]">{posicao}</span>
        <span role="img" aria-label={l.readProgress.replace("{n}", String(lido))} className="h-1.5 min-w-20 max-w-md flex-1 bg-[#3a3020]">
          <span className="block h-full bg-[#c21f16] transition-[width] duration-150" style={{ width: `${lido}%` }} />
        </span>
        <span className="text-[#b3a584] max-sm:hidden">{minutos}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {podeOuvir && (
            <button type="button" className={botao} aria-pressed={falando} onClick={() => (falando ? stopReading() : startReading(TRECHOS_DA_AULA))}>
              {falando ? l.stopListening : l.listen}
            </button>
          )}
          <button type="button" className={`${botao} max-xl:hidden`} onClick={() => window.dispatchEvent(new CustomEvent(ABRIR_CAIXA, { detail: "" }))}>
            {ferramentas}
          </button>
          <button type="button" className={botao} onClick={() => window.dispatchEvent(new Event(ANOTAR))}>
            {l.annotate}
          </button>
          <span role="group" aria-label={l.width} className="flex items-center gap-1 max-lg:hidden">
            <button type="button" className={botao} aria-pressed={modo === "larga"} onClick={() => escolher(modo === "larga" ? "normal" : "larga")}>
              ⟷ {l.widthWide}
            </button>
          </span>
          <button type="button" className={botao} aria-pressed={modo === "foco"} onClick={() => escolher(modo === "foco" ? "normal" : "foco")}>
            {modo === "foco" ? l.focusExit : l.focus}
          </button>
        </span>
      </div>
    </div>
  );
}
