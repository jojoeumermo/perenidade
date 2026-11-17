// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { COAUTORIA_VAZIA, type CoautoriaDoCartao } from "@/lib/rede/tipos-conversa";
import { coautoriaDoCartao } from "./cliente";
import { carregarTextosDaCoautoria, type TextosDaCoautoria } from "./textos";

/** Avisa todos os cartões do mesmo post quando um deles muda (convidar, aceitar, pedir a fonte, marcar). */
const MUDOU = "alumia-coautoria-mudou";
export function avisarQueMudou(id?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MUDOU, { detail: id ?? null }));
}

/** O painel que o menu "mais" do cartão abre embaixo do texto do post. */
export type PainelDaCoautoria = "assinar" | "fonte" | "marcar";
const ABRIR = "alumia-coautoria-abrir";
export function abrirPainel(post: string, painel: PainelDaCoautoria) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(ABRIR, { detail: { post, painel } }));
}
export function useAbrirPainel(post: string, abrir: (p: PainelDaCoautoria) => void) {
  useEffect(() => {
    const ouvir = (e: Event) => {
      const d = (e as CustomEvent<{ post: string; painel: PainelDaCoautoria }>).detail;
      if (d?.post === post) abrir(d.painel);
    };
    window.addEventListener(ABRIR, ouvir);
    return () => window.removeEventListener(ABRIR, ouvir);
  }, [post, abrir]);
}

/** Os textos do idioma (nulo enquanto carrega). */
export function useTextosDaCoautoria(lang: string): TextosDaCoautoria | null {
  const [t, setT] = useState<TextosDaCoautoria | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDaCoautoria(lang).then((x) => vivo && setT(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t;
}

/** O que a frente sabe deste post e os textos do idioma. Enquanto carrega, tudo vazio (o cartão não muda). */
export function useCoautoriaDoCartao(id: string, lang: string): { c: CoautoriaDoCartao; t: TextosDaCoautoria | null; renovar: () => void } {
  const [c, setC] = useState<CoautoriaDoCartao>(COAUTORIA_VAZIA);
  const t = useTextosDaCoautoria(lang);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    let vivo = true;
    void coautoriaDoCartao(id, vez > 0).then((x) => vivo && setC(x));
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
