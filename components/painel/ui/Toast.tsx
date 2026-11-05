// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type CSSProperties } from "react";
import { toast, Toaster } from "sonner";

// As cores do aviso vêm dos tokens do tema (styles/painel-tema.css), então o claro, o escuro e o alto contraste valem sozinhos.
const estilo = {
  "--normal-bg": "var(--pn-superficie)",
  "--normal-text": "var(--pn-texto)",
  "--normal-border": "var(--pn-borda-forte)",
  "--success-bg": "var(--pn-superficie)",
  "--success-text": "var(--pn-texto)",
  "--success-border": "var(--pn-borda-forte)",
  "--error-bg": "var(--pn-superficie)",
  "--error-text": "var(--pn-erro)",
  "--error-border": "var(--pn-erro)",
  "--border-radius": "var(--pn-raio-cartao)",
  fontFamily: "var(--pn-fonte)",
} as CSSProperties;

/** Monte uma vez só (nas camadas da casca, casca/Camadas.tsx). Os avisos ficam no canto de baixo à direita; no celular, acima da barra de baixo. */
export function AvisosDoPainel() {
  return <Toaster position="bottom-right" style={estilo} offset={{ bottom: "1rem", right: "1rem" }} mobileOffset={{ bottom: "5rem", left: "1rem", right: "1rem" }} closeButton visibleToasts={3} />;
}

/** Avisos curtos: confirmação do que foi feito (ok), erro com o que fazer (erro) e informação (info). */
export const notificar = {
  ok: (texto: string) => toast.success(texto),
  erro: (texto: string) => toast.error(texto),
  info: (texto: string) => toast(texto),
  /** Aviso com um botão de desfazer (some depois de alguns segundos). */
  desfazer: (texto: string, aoDesfazer: () => void) => toast(texto, { action: { label: "Desfazer", onClick: aoDesfazer }, duration: 8000 }),
};
