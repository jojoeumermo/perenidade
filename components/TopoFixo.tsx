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
    // Encolher a faixa diminui a página e mexe na posição da rolagem: com um limite só, a faixa encolhia, a rolagem
    // voltava para baixo do limite, ela crescia de novo, e assim sem parar. Por isso dois limites bem afastados
    // (encolhe depois de 160 px, só volta perto do topo) e nada de encolher em página que mal rola.
    let rolou = false;
    const rolar = () => {
      const sobra = document.documentElement.scrollHeight - window.innerHeight;
      const agora = rolou ? window.scrollY > 24 : window.scrollY > 160 && sobra > 400;
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
