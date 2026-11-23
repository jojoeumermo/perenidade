// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O "voltar ao topo" da própria Alumia (P5, A5): antes aparecia o do site do instituto (quadrado de papel, sombra dura). Este é
// redondo, com os tokens da Alumia, e só aparece depois de uma boa rolagem. A volta é suave só para quem não pediu menos
// movimento. O do site some nas telas da Alumia (styles/alumia-tokens.css).
import { useEffect, useState } from "react";
import { podeMexer } from "@/lib/rede/atos/movimento";

export function SubirAoTopo({ rotulo }: { rotulo: string }) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const ver = () => setVisivel(window.scrollY > 900);
    ver();
    window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);
  if (!visivel) return null;
  return (
    <button type="button" className="al-subir no-print" aria-label={rotulo} title={rotulo}
      onClick={() => {
        window.scrollTo({ top: 0, behavior: podeMexer() ? "smooth" : "auto" });
        // O foco volta ao começo da tela (quem usa teclado não fica preso no fim da página).
        document.getElementById("rede-linha")?.focus({ preventScroll: true });
      }}>
      <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  );
}
