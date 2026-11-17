// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { acompanharAparencia, APARENCIA_PADRAO, type AparenciaDaAlumia } from "@/lib/rede/aparencia-da-rede";
import { carregarTextosDoAcabamento, type TextosDoAcabamento } from "@/lib/rede/textos-acabamento";
import "./acabamento.css";

/** Os textos do acabamento no idioma da página (só um idioma chega ao navegador). Nulo enquanto carrega. */
export function useTextosDoAcabamento(lang: string | null): TextosDoAcabamento | null {
  const [t, setT] = useState<{ lang: string; t: TextosDoAcabamento } | null>(null);
  useEffect(() => {
    // Nulo: a tela não precisa destes textos (a rede de hoje), e nada é baixado.
    if (lang === null) return;
    let vivo = true;
    carregarTextosDoAcabamento(lang).then((x) => vivo && setT({ lang, t: x }), () => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  return t?.lang === lang ? t.t : null;
}

/**
 * Mantém o tema e o "ocultar números" em dia na caixa da Alumia (lib/rede/aparencia-da-rede.ts). O <script> do layout já pôs os
 * atributos antes da primeira pintura; esta peça cuida de quem chegou navegando de dentro do site (o script não roda de novo),
 * do aparelho que troca de tema e da escolha feita em outra aba. Não desenha nada.
 */
export function ManterAparencia() {
  useEffect(() => acompanharAparencia(), []);
  return null;
}

/** A escolha de aparência deste aparelho, viva (muda quando a tela de ajustes muda). No servidor e antes de montar, o padrão. */
export function useAparencia(): AparenciaDaAlumia {
  const [a, setA] = useState<AparenciaDaAlumia>(APARENCIA_PADRAO);
  useEffect(() => acompanharAparencia(setA), []);
  return a;
}
