// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef } from "react";
import { carregarTudo, desenhar, type Documento, usarVariaveis } from "./motor";

/**
 * Uma prévia de documento desenhada num canvas pequeno, na densidade da tela. Redesenha (com uma pequena espera)
 * quando o documento muda; com "vars", desenha com as variáveis daquela página e volta às da página aberta.
 */
export function Miniatura({ doc, largura, className = "", vars, voltar, t, transparente }: { doc: Documento; largura: number; className?: string; vars?: Record<string, string>; voltar?: Record<string, string>; t?: number; transparente?: boolean }) {
  const tela = useRef<HTMLCanvasElement>(null);
  // As variáveis entram pelo conteúdo (o objeto muda a cada desenho da tela, o valor quase nunca).
  const chave = vars ? JSON.stringify(vars) : "";
  const voltarRef = useRef(voltar);
  useEffect(() => {
    voltarRef.current = voltar;
  });
  useEffect(() => {
    let vivo = true;
    const id = window.setTimeout(async () => {
      await carregarTudo(doc);
      if (!vivo || !tela.current) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (chave) usarVariaveis(JSON.parse(chave));
      desenhar(tela.current, doc, (largura / doc.w) * dpr, { exportar: true, t, transparente });
      if (chave && voltarRef.current) usarVariaveis(voltarRef.current);
    }, 80);
    return () => {
      vivo = false;
      window.clearTimeout(id);
    };
  }, [doc, largura, chave, t, transparente]);
  return <canvas ref={tela} className={className} style={{ width: largura, height: (largura * doc.h) / doc.w }} aria-hidden />;
}
