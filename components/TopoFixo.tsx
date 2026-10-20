// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";

/**
 * A faixa do topo fica presa ao rolar a página: o painel, a busca e o menu ficam sempre à mão. Este pedaço mede a
 * altura da faixa (para os índices laterais e as âncoras pararem logo abaixo dela) e marca quando a página rolou,
 * para a faixa encolher e não roubar espaço de leitura. Fora do site público (no painel), nada disso existe.
 */
export function TopoFixo() {
  useEffect(() => {
    const raiz = document.documentElement;
    const topo = document.querySelector<HTMLElement>(".cabecalho-site");
    if (!topo) return;
    raiz.setAttribute("data-topo-fixo", "");
    const medir = () => raiz.style.setProperty("--altura-topo", `${Math.round(topo.getBoundingClientRect().height)}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(topo);
    let rolou = false;
    const rolar = () => {
      const agora = window.scrollY > 140;
      if (agora === rolou) return;
      rolou = agora;
      if (agora) raiz.setAttribute("data-rolou", "");
      else raiz.removeAttribute("data-rolou");
    };
    rolar();
    window.addEventListener("scroll", rolar, { passive: true });
    return () => {
      observador.disconnect();
      window.removeEventListener("scroll", rolar);
      raiz.removeAttribute("data-topo-fixo");
      raiz.removeAttribute("data-rolou");
      raiz.style.removeProperty("--altura-topo");
    };
  }, []);
  return null;
}
