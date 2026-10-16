// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { hasBackend, hasSession, rpc } from "./backend";
import { getItem, parse, setItem } from "./storage";

const PREFIXO = "lucia:rascunho:";

interface Guardado<T> {
  dados: T;
  em: number;
}

/**
 * Rascunho que não se perde. O que a pessoa está escrevendo é guardado neste navegador a cada pausa de um segundo e,
 * para quem tem conta, também no banco alguns segundos depois: fechou o navegador, atualizou a página ou abriu de outro
 * aparelho, o texto volta sozinho (vale a cópia mais recente das duas). Quando o formulário fica vazio (depois de enviar),
 * o rascunho é apagado dos dois lugares.
 */
export function useRascunho<T extends object>(
  chave: string,
  estado: T,
  aplicar: (dados: T) => void,
  { ativo = true, vazio }: { ativo?: boolean; vazio?: (dados: T) => boolean } = {},
) {
  const [situacao, setSituacao] = useState<{ restaurado: boolean; salvoEm: number | null; pronto: boolean }>({ restaurado: false, salvoEm: null, pronto: false });
  const aplicarRef = useRef(aplicar);
  const vazioRef = useRef(vazio);
  useEffect(() => {
    aplicarRef.current = aplicar;
    vazioRef.current = vazio;
  });
  /** O último texto guardado, para não guardar o mesmo duas vezes. */
  const ultimo = useRef("");
  const pronto = useRef(false);
  const comConta = hasBackend && hasSession();

  // Ao abrir: recupera o rascunho (a cópia mais nova entre o navegador e o banco).
  useEffect(() => {
    pronto.current = false;
    let cancelado = false;
    const local = parse<Guardado<T> | null>(getItem(PREFIXO + chave), null);
    const terminar = (melhor: Guardado<T> | null) => {
      if (cancelado) return;
      pronto.current = true;
      if (melhor && melhor.dados && typeof melhor.dados === "object" && !vazioRef.current?.(melhor.dados)) {
        ultimo.current = JSON.stringify(melhor.dados);
        aplicarRef.current(melhor.dados);
        setSituacao({ restaurado: true, salvoEm: melhor.em, pronto: true });
      } else {
        setSituacao({ restaurado: false, salvoEm: null, pronto: true });
      }
    };
    if (comConta) {
      rpc<{ dados: T; atualizado_em: string } | null>("rascunho_ver", { p_chave: chave })
        .then((remoto) => {
          const guardado = remoto ? { dados: remoto.dados, em: new Date(remoto.atualizado_em).getTime() } : null;
          terminar(!guardado ? local : !local ? guardado : guardado.em > local.em ? guardado : local);
        })
        .catch(() => terminar(local));
    } else terminar(local);
    return () => {
      cancelado = true;
    };
  }, [chave, comConta]);

  // A cada mudança: guarda no navegador depois de um segundo parado, e no banco depois de quatro.
  const json = JSON.stringify(estado);
  useEffect(() => {
    if (!ativo || !pronto.current || json === ultimo.current) return;
    if (vazioRef.current?.(estado)) {
      // Formulário esvaziado (enviado ou limpo): o rascunho sai dos dois lugares.
      if (ultimo.current) {
        ultimo.current = "";
        setItem(PREFIXO + chave, null);
        setSituacao((s) => ({ ...s, restaurado: false, salvoEm: null }));
        if (comConta) rpc("rascunho_apagar", { p_chave: chave }).catch(() => undefined);
      }
      return;
    }
    const local = window.setTimeout(() => {
      ultimo.current = json;
      const em = Date.now();
      setItem(PREFIXO + chave, JSON.stringify({ dados: estado, em } satisfies Guardado<T>));
      setSituacao((s) => ({ ...s, salvoEm: em }));
    }, 1000);
    const remoto = window.setTimeout(() => {
      if (comConta) rpc("rascunho_salvar", { p_chave: chave, p_dados: estado }).catch(() => undefined);
    }, 4000);
    return () => {
      window.clearTimeout(local);
      window.clearTimeout(remoto);
    };
    // "estado" é o próprio objeto já refletido em "json".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [json, chave, ativo, comConta]);

  // Saindo da página com algo ainda não enviado ao banco: manda agora.
  useEffect(() => {
    if (!comConta) return;
    const agora = () => {
      if (document.visibilityState !== "hidden" || !ultimo.current || vazioRef.current?.(JSON.parse(ultimo.current) as T)) return;
      rpc("rascunho_salvar", { p_chave: chave, p_dados: JSON.parse(ultimo.current) as object }).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", agora);
    return () => document.removeEventListener("visibilitychange", agora);
  }, [chave, comConta]);

  const limpar = useCallback(() => {
    ultimo.current = "";
    setItem(PREFIXO + chave, null);
    setSituacao({ restaurado: false, salvoEm: null, pronto: true });
    if (hasBackend && hasSession()) rpc("rascunho_apagar", { p_chave: chave }).catch(() => undefined);
  }, [chave]);

  return { ...situacao, limpar };
}

/** "guardado às 14:03" para a linha de situação dos formulários. */
export const horaDoRascunho = (em: number) => new Date(em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
