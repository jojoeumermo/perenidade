// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do navegador da frente 13D: o armazenamento deste aparelho, o aviso entre as partes da tela quando a fila muda, a trava
// entre abas (Web Locks, quando o navegador tem) e o envio pela função de publicar de sempre. As contas estão em ./regras.ts.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { rede } from "@/lib/rede/cliente";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { CHAVES_DO_LEVE, lerFila, mandarFila, type ArmazemDaFila, type ItemDaFila, type ResultadoDoEnvio } from "./regras";

/** Avisa as partes da tela (na mesma aba) que a fila ou a hora de parar mudaram; entre abas, vale o evento "storage". */
export const EVENTO_DO_LEVE = "alumia:leve";

export function armazemDoAparelho(): ArmazemDaFila | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function avisarMudanca(): void {
  window.dispatchEvent(new Event(EVENTO_DO_LEVE));
}

function assinar(avisar: () => void): () => void {
  window.addEventListener(EVENTO_DO_LEVE, avisar);
  window.addEventListener("storage", avisar);
  return () => {
    window.removeEventListener(EVENTO_DO_LEVE, avisar);
    window.removeEventListener("storage", avisar);
  };
}

function lerChave(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** O texto cru da fila (o useSyncExternalStore compara texto; a lista sai dele). */
const filaCrua = () => lerChave(CHAVES_DO_LEVE.fila) ?? "";

/** A fila deste aparelho, viva: muda quando outra parte da tela (ou outra aba) mexe. Nulo antes de montar. */
export function useFila(): ItemDaFila[] | null {
  const cru = useSyncExternalStore(assinar, filaCrua, () => null);
  return useMemo(() => (cru === null ? null : lerFila({ getItem: () => cru || null, setItem: () => undefined, removeItem: () => undefined })), [cru]);
}

/** A hora de parar guardada ("23:00") ou nula; muda junto com o ajuste. */
export function useHoraDeParar(): [string | null | undefined, (hora: string | null) => void] {
  const hora = useSyncExternalStore(assinar, () => lerChave(CHAVES_DO_LEVE.parar), () => undefined);
  const mudar = useCallback((nova: string | null) => {
    try {
      if (nova) window.localStorage.setItem(CHAVES_DO_LEVE.parar, nova);
      else window.localStorage.removeItem(CHAVES_DO_LEVE.parar);
      window.localStorage.removeItem(CHAVES_DO_LEVE.pararVisto);
    } catch {
      // sem armazenamento: o lembrete não fica guardado
    }
    avisarMudanca();
  }, []);
  return [hora, mudar];
}

/** O relógio para a tela (0 antes de montar), andando a cada `passo` ms: as contas de "há quanto tempo" não rodam no desenho. */
export function useAgora(passo = 30_000): number {
  const [agora, setAgora] = useState(0);
  useEffect(() => {
    const andar = () => setAgora(Date.now());
    const id0 = window.setTimeout(andar, 0);
    const id = window.setInterval(andar, passo);
    const voltar = () => document.visibilityState === "visible" && andar();
    document.addEventListener("visibilitychange", voltar);
    window.addEventListener(EVENTO_DO_LEVE, andar);
    return () => {
      window.clearTimeout(id0);
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", voltar);
      window.removeEventListener(EVENTO_DO_LEVE, andar);
    };
  }, [passo]);
  return agora;
}

/** Está sem rede agora? (navigator.onLine falso quer dizer, com certeza, sem rede; verdadeiro pode ser rede ruim.) */
export function semRede(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** A rede deste aparelho, viva (o "online"/"offline" do navegador). */
export function useComRede(): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    const ver = () => setOk(!semRede());
    const id = window.setTimeout(ver, 0);
    window.addEventListener("online", ver);
    window.addEventListener("offline", ver);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", ver);
      window.removeEventListener("offline", ver);
    };
  }, []);
  return ok;
}

type Travas = { request: (nome: string, opcoes: { ifAvailable: boolean }, fazer: (trava: unknown) => Promise<unknown>) => Promise<unknown> };

/**
 * Manda a fila da conta aberta (ou só os ids pedidos). Uma aba de cada vez: com Web Locks, a outra aba nem tenta (ifAvailable);
 * sem elas, a marca "enviando" no próprio item segura. Na prévia nada é publicado (não há banco).
 */
export async function mandarDoAparelho(conta: string | null | undefined, soEstes?: readonly string[]): Promise<ResultadoDoEnvio> {
  const vazio: ResultadoDoEnvio = { saiu: [], recusado: [], esperando: 0 };
  if (previaLigada() || !conta) return vazio;
  const fazer = async () => {
    const r = await mandarFila({
      armazem: armazemDoAparelho(),
      conta,
      publicar: (pedido) => rede.publicar(pedido),
      agora: () => Date.now(),
      semRede,
      soEstes,
    });
    avisarMudanca();
    return r;
  };
  const travas = (navigator as { locks?: Travas }).locks;
  if (!travas) return fazer();
  let r = vazio;
  await travas.request("lucia:rede:leve:fila", { ifAvailable: true }, async (trava) => {
    if (trava) r = await fazer();
  });
  return r;
}

/** Um id deste aparelho para o item da fila (só para achar o item; não vai a lugar nenhum). */
export function sortearId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
