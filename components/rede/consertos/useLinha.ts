// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { consertos } from "@/lib/rede/cliente-consertos";
import type { ModoDaLinha } from "@/lib/rede/tipos-consertos";

/**
 * A linha da Rede de hoje por cursor: a primeira página sozinha e "carregar mais" para as outras, sem repetir nem pular o que
 * chegou no meio. `versao` recarrega do começo. Guarda a hora em que a página de cima foi carregada (para o "N novos").
 */
export function useLinha<P extends { id: string }>({ ativo, modo, comunidade, usuario, versao }: { ativo: boolean; modo: ModoDaLinha | null; comunidade: string | null; usuario: string | null; versao: number }) {
  const [posts, setPosts] = useState<P[] | null>(null);
  const [proximo, setProximo] = useState<string | null>(null);
  const [erro, setErro] = useState(false);
  const [maisOcupado, setMaisOcupado] = useState(false);
  const carregadoEm = useRef(new Date().toISOString());
  const chave = `${modo}|${comunidade}|${usuario}|${versao}`;
  const chaveAtual = useRef(chave);
  useEffect(() => {
    chaveAtual.current = chave;
  }, [chave]);

  useEffect(() => {
    if (!ativo || !modo) return;
    let vivo = true;
    const desde = new Date().toISOString();
    consertos
      .linha<P>(modo, { comunidade, usuario })
      .then((pagina) => {
        if (!vivo) return;
        setPosts(pagina.itens);
        setProximo(pagina.proximo);
        setErro(false);
        carregadoEm.current = desde;
      })
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [ativo, modo, comunidade, usuario, versao]);

  const maisUma = useCallback(async () => {
    if (!modo || !proximo || maisOcupado) return;
    const pedida = chaveAtual.current;
    setMaisOcupado(true);
    try {
      const pagina = await consertos.linha<P>(modo, { comunidade, usuario, cursor: proximo });
      if (pedida !== chaveAtual.current) return;
      // Sem repetir: um post que já está na lista (porque a linha mexeu entre as páginas) não entra de novo.
      setPosts((atuais) => {
        const ja = new Set((atuais ?? []).map((p) => p.id));
        return [...(atuais ?? []), ...pagina.itens.filter((p) => !ja.has(p.id))];
      });
      setProximo(pagina.proximo);
    } catch {
      setErro(true);
    } finally {
      setMaisOcupado(false);
    }
  }, [modo, comunidade, usuario, proximo, maisOcupado]);

  const limpar = useCallback(() => {
    setPosts(null);
    setProximo(null);
  }, []);

  return { posts, proximo, erro, maisOcupado, maisUma, carregadoEm, limpar };
}
