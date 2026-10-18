// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";

/** Nas páginas longas, um botão discreto que volta ao topo. Aparece depois de uma boa rolagem. */
export function VoltarAoTopo({ label }: { label: string }) {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const ver = () => setVisivel(window.scrollY > 900);
    ver();
    window.addEventListener("scroll", ver, { passive: true });
    return () => window.removeEventListener("scroll", ver);
  }, []);
  if (!visivel) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={label}
      title={label}
      className="no-print fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-3 z-30 flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-ink bg-parchment font-sans text-lg shadow-[3px_3px_0_var(--ink)] hover:border-oxblood hover:text-oxblood md:bottom-6 md:left-6"
    >
      <span aria-hidden>↑</span>
    </button>
  );
}
