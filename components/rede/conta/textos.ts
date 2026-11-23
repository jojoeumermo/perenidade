// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os textos do grupo "conta, identidade e convivência" (i18n/rede/conta/): o português é o final; os outros cinco idiomas são
// rascunho até a revisão e, enquanto forem, a tela mostra o português (lib/rede/textos-prontos.ts).
import { useCallback, useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";
import { carregarPronto } from "@/lib/rede/textos-prontos";
import { criarUsoDeTextos } from "../mapa/comum";
import type pt from "../../../i18n/rede/conta/pt.json";

export type TextosDaConta = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/conta/pt.json"),
  en: () => import("../../../i18n/rede/conta/en.json"),
  es: () => import("../../../i18n/rede/conta/es.json"),
  fr: () => import("../../../i18n/rede/conta/fr.json"),
  ru: () => import("../../../i18n/rede/conta/ru.json"),
  zh: () => import("../../../i18n/rede/conta/zh.json"),
};

export const carregarTextosDaConta = async (lang: string) => (await carregarPronto(CARREGAR, lang)) as TextosDaConta;
export const useTextosDaConta = criarUsoDeTextos(carregarTextosDaConta);

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function fraseDoErro(t: TextosDaConta, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : e instanceof Error ? e.message : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

/** Carrega uma resposta do banco e recarrega quando a chave muda ou quando `recarregar` é chamado. Guarda o erro, sem quebrar. */
export function useCarga<T>(chave: string | null, buscar: () => Promise<T>): { dado: T | null; erro: unknown; recarregar: () => void; trocar: (d: T) => void } {
  const [estado, setEstado] = useState<{ chave: string | null; vez: number; dado: T | null; erro: unknown }>({ chave: null, vez: -1, dado: null, erro: null });
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (chave === null) return;
    let vivo = true;
    buscar().then(
      (dado) => vivo && setEstado({ chave, vez, dado, erro: null }),
      (erro: unknown) => vivo && setEstado((e) => ({ chave, vez, dado: e.chave === chave ? e.dado : null, erro })),
    );
    return () => {
      vivo = false;
    };
    // `buscar` muda a cada desenho; a chave e a vez decidem quando buscar de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, vez]);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);
  const trocar = useCallback((dado: T) => setEstado((e) => ({ ...e, dado, erro: null })), []);
  return { dado: estado.chave === chave ? estado.dado : null, erro: estado.chave === chave ? estado.erro : null, recarregar, trocar };
}

/** O localStorage, quando dá (aba privada ou bloqueio: um mapa na memória, que some ao fechar). */
const naMemoria = new Map<string, string>();
export const guarda = {
  getItem(chave: string): string | null {
    try {
      return localStorage.getItem(chave);
    } catch {
      return naMemoria.get(chave) ?? null;
    }
  },
  setItem(chave: string, valor: string) {
    try {
      localStorage.setItem(chave, valor);
    } catch {
      naMemoria.set(chave, valor);
    }
  },
  removeItem(chave: string) {
    try {
      localStorage.removeItem(chave);
    } catch {
      naMemoria.delete(chave);
    }
  },
};
