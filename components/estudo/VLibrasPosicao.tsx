// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { arrastavel, estiloDaPosicao, gravarPosicao, lerPosicao, type Posicao, posicaoDoPonto, usePosicoes } from "@/lib/flutuantes";
import { assinarVLibras, quadroDoVLibras, vlibrasCarregado } from "@/lib/vlibras";

// O tamanho do botão azul do VLibras, para as contas da posição livre.
const TAMANHO = "3.5rem";
const PROPRIEDADES = ["top", "bottom", "left", "right", "transform"] as const;

/** Põe o quadro do VLibras na posição escolhida (ou devolve ao lugar de sempre, o do próprio tradutor). */
function posicionar(quadro: HTMLElement, posicao: Posicao | null) {
  if (!posicao) {
    for (const p of PROPRIEDADES) quadro.style.removeProperty(p);
    return;
  }
  const estilo = estiloDaPosicao(posicao, TAMANHO);
  for (const [p, v] of Object.entries(estilo)) quadro.style.setProperty(p, v, "important");
  // O tradutor centraliza o botão na lateral com translateY(-50%): fora do lugar de sempre, sem isso ele sairia do ponto.
  quadro.style.setProperty("transform", "none", "important");
}

const ligadoAgora = () => vlibrasCarregado();

/**
 * O botão do VLibras no lugar que a pessoa escolheu (T11): arrastar o botão azul (mouse ou dedo) ou escolher o canto no
 * painel de acessibilidade. Não desenha nada e só trabalha com o VLibras ligado: antes disso, nem procura o quadro.
 */
export default function VLibrasPosicao() {
  const ligado = useSyncExternalStore(assinarVLibras, ligadoAgora, () => false);
  const posicoes = usePosicoes();
  const posicao = posicoes.vlibras ?? null;

  useEffect(() => {
    if (!ligado) return;
    let soltarArrasto: (() => void) | null = null;
    let espera: MutationObserver | null = null;
    let prazo = 0;
    const preparar = (quadro: HTMLElement) => {
      posicionar(quadro, lerPosicao("vlibras"));
      // Só o botão azul arrasta: dentro do avatar aberto, arrastar é do próprio tradutor (rolar, mudar o tamanho).
      const botao = quadro.querySelector<HTMLElement>("[vw-access-button]");
      if (botao) botao.style.touchAction = "none";
      soltarArrasto = arrastavel(quadro, {
        podeComecar: (alvo) => alvo instanceof Element && Boolean(alvo.closest("[vw-access-button]")),
        mover: (x, y) => {
          const r = quadro.getBoundingClientRect();
          posicionar(quadro, posicaoDoPonto(x, y, r.width, r.height));
        },
        soltar: (x, y) => {
          const r = quadro.getBoundingClientRect();
          gravarPosicao("vlibras", posicaoDoPonto(x, y, r.width, r.height));
        },
      });
    };
    const achado = quadroDoVLibras();
    if (achado) preparar(achado);
    else {
      // O tradutor monta o quadro um pouco depois de carregar: espera por ele (no máximo 20 s).
      espera = new MutationObserver(() => {
        const q = quadroDoVLibras();
        if (!q) return;
        espera?.disconnect();
        window.clearTimeout(prazo);
        preparar(q);
      });
      espera.observe(document.body, { childList: true, subtree: true });
      prazo = window.setTimeout(() => espera?.disconnect(), 20_000);
    }
    return () => {
      espera?.disconnect();
      window.clearTimeout(prazo);
      soltarArrasto?.();
    };
  }, [ligado]);

  // Mudou a posição (pelo painel ou em outra aba): aplica.
  useEffect(() => {
    if (!ligado) return;
    const quadro = quadroDoVLibras();
    if (quadro) posicionar(quadro, posicao);
  }, [ligado, posicao]);

  return null;
}
