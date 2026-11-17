// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { protecaoDoCartao } from "@/lib/rede/cliente-protecao";
import { carregarTextosDaProtecao, type TextosDaProtecao } from "@/lib/rede/textos-protecao";
import { CARTAO_VAZIO, type ProtecaoDoCartao } from "@/lib/rede/tipos-protecao";

/** Avisa todos os cartões do mesmo post quando um deles muda (liberar, desvincular, restringir). */
const MUDOU = "alumia-protecao-mudou";
export function avisarQueMudou(id?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MUDOU, { detail: id ?? null }));
}

/** O que a proteção sabe deste post e os textos do idioma. Enquanto carrega, tudo desligado (o cartão não muda). */
export function useProtecaoDoCartao(id: string, lang: string): { c: ProtecaoDoCartao; t: TextosDaProtecao | null; renovar: () => void } {
  const [c, setC] = useState<ProtecaoDoCartao>(CARTAO_VAZIO);
  const [t, setT] = useState<TextosDaProtecao | null>(null);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDaProtecao(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  useEffect(() => {
    let vivo = true;
    void protecaoDoCartao(id, vez > 0).then((x) => vivo && setC(x));
    return () => {
      vivo = false;
    };
  }, [id, vez]);
  useEffect(() => {
    const ouvir = (e: Event) => {
      const alvo = (e as CustomEvent<string | null>).detail;
      if (alvo === null || alvo === id) setVez((v) => v + 1);
    };
    window.addEventListener(MUDOU, ouvir);
    return () => window.removeEventListener(MUDOU, ouvir);
  }, [id]);
  const renovar = useCallback(() => avisarQueMudou(id), [id]);
  return { c, t, renovar };
}
