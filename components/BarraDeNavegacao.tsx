// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A barra fina no alto enquanto a próxima página chega. Sem ela, o clique num link não dava sinal nenhum até a página nova
// aparecer (meio segundo ou mais no celular), e parecia que o site tinha travado. Ela nasce no clique e some quando o endereço
// muda; se a troca não vier (download, erro), some sozinha. Com "menos movimento", fica parada, sem animar.
// Nada é guardado nem enviado: só escuta cliques dentro da própria página.
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const PRAZO_MS = 10_000;

function linkDeDentro(evento: MouseEvent): boolean {
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return false;
  const alvo = (evento.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!alvo || (alvo.target && alvo.target !== "_self") || alvo.hasAttribute("download")) return false;
  let destino: URL;
  try {
    destino = new URL(alvo.href, location.href);
  } catch {
    return false;
  }
  if (destino.origin !== location.origin) return false;
  // Só o "#" muda: não há página nova para esperar.
  return !(destino.pathname === location.pathname && destino.search === location.search);
}

export function BarraDeNavegacao() {
  const caminho = usePathname();
  // O endereço de onde saiu o clique: a barra vale enquanto ainda estamos nele. Mudou o endereço, ela some sem precisar de efeito.
  const [saindoDe, setSaindoDe] = useState<string | null>(null);
  const prazo = useRef<number | undefined>(undefined);

  useEffect(() => {
    const aoClicar = (evento: MouseEvent) => {
      // Na captura, antes do Link do Next (que cancela o clique para trocar a página sem recarregar).
      if (!linkDeDentro(evento)) return;
      setSaindoDe(location.pathname);
      window.clearTimeout(prazo.current);
      prazo.current = window.setTimeout(() => setSaindoDe(null), PRAZO_MS);
    };
    document.addEventListener("click", aoClicar, true);
    return () => {
      document.removeEventListener("click", aoClicar, true);
      window.clearTimeout(prazo.current);
    };
  }, []);

  // Chegou a página nova: esquece o clique (senão, voltar ao mesmo endereço logo depois acenderia a barra de novo).
  if (saindoDe !== null && saindoDe !== caminho) setSaindoDe(null);
  if (saindoDe === null || saindoDe !== caminho) return null;
  return <div className="barra-de-navegacao" role="progressbar" aria-label="Carregando a página" aria-busy="true" />;
}
