// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useSyncExternalStore } from "react";

// Modo discreto da Escola (prancha Hoje): a aba ganha um nome neutro ("Anotações") e os links da Escola trocam a página
// em vez de empilhar no histórico de voltar. Nasce LIGADO e vale só para esta aba (sessionStorage): fechou a aba, volta
// ao padrão. Não apaga o histórico do navegador (isso só a janela anônima evita) — o modo seguro do site
// (lib/modo-seguro.ts, /modo-seguro) continua sendo o caminho para sair rápido e apagar o aparelho.

const CHAVE = "lucia-escola-discreto";
const EVENTO = "lucia:escola-discreto";

function ler(): boolean {
  try {
    return sessionStorage.getItem(CHAVE) !== "0";
  } catch {
    return true;
  }
}

function assinar(avisar: () => void) {
  window.addEventListener(EVENTO, avisar);
  return () => window.removeEventListener(EVENTO, avisar);
}

export function definirModoDiscreto(ligado: boolean) {
  try {
    sessionStorage.setItem(CHAVE, ligado ? "1" : "0");
  } catch {
    // sem sessionStorage: fica o padrão (ligado)
  }
  window.dispatchEvent(new Event(EVENTO));
}

export interface ModoDiscreto {
  ligado: boolean;
  definir: (ligado: boolean) => void;
}

/** O estado do modo discreto e, enquanto ligado, o título neutro da aba (mesmo quando a página troca o título). */
export function useModoDiscreto(tituloNeutro: string): ModoDiscreto {
  const ligado = useSyncExternalStore(assinar, ler, () => true);

  useEffect(() => {
    if (!ligado) return;
    const original = document.title;
    let guardado = original;
    const neutro = () => {
      if (document.title !== tituloNeutro) {
        guardado = document.title;
        document.title = tituloNeutro;
      }
    };
    neutro();
    const olho = new MutationObserver(neutro);
    olho.observe(document.head, { subtree: true, childList: true, characterData: true });
    return () => {
      olho.disconnect();
      document.title = guardado;
    };
  }, [ligado, tituloNeutro]);

  return { ligado, definir: definirModoDiscreto };
}

export function CaixaDoModoDiscreto({ modo, rotulo, texto }: { modo: ModoDiscreto; rotulo: string; texto: string }) {
  return (
    <label className="ef-discreto">
      <input type="checkbox" checked={modo.ligado} onChange={(e) => modo.definir(e.target.checked)} />
      <span>
        <strong>{rotulo}</strong>
        <span className="ef-discreto-texto">{texto}</span>
      </span>
    </label>
  );
}
