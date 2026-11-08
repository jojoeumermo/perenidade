// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useSyncExternalStore } from "react";
import { arrastavel, estiloDaPosicao, gravarPosicao, ladoDe, lerPosicao, type Posicao, posicaoDoPonto, usePosicoes } from "@/lib/flutuantes";
import { assinarVLibras, botaoDoVLibras, quadroDoVLibras, vlibrasCarregado } from "@/lib/vlibras";

// O tamanho do botão azul do VLibras (40 px na versão 7), para as contas da posição livre.
const TAMANHO = "40px";
const PROPRIEDADES = ["top", "bottom", "left", "right", "transform", "flex-direction"] as const;

/**
 * Põe o botão do VLibras na posição escolhida (ou devolve ao lugar de sempre, o do próprio tradutor). Na versão 7 o
 * elemento fixo na tela ("#vlibras-access") fica dentro da shadow root do tradutor, com a posição na folha de estilo
 * dele: o estilo direto no elemento (com !important) passa por cima. O botão fica encostado no lado de fora, e o balão
 * "Acessível com VLibras" que abre ao passar o mouse cresce para dentro da tela.
 */
function posicionar(posicao: Posicao | null) {
  const caixa = botaoDoVLibras();
  if (!caixa) return;
  // O botão em si (versão 7), encostado por padrão à direita da caixa: vai junto para o lado escolhido.
  const raiz = caixa.getRootNode();
  const interno = raiz instanceof ShadowRoot ? raiz.getElementById("vlibras-button") : null;
  if (!posicao) {
    for (const p of PROPRIEDADES) caixa.style.removeProperty(p);
    interno?.style.removeProperty("left");
    interno?.style.removeProperty("right");
    return;
  }
  const estilo = estiloDaPosicao(posicao, TAMANHO);
  for (const [p, v] of Object.entries(estilo)) caixa.style.setProperty(p, v, "important");
  // A versão antiga centralizava o botão na lateral com translateY(-50%): fora do lugar de sempre, ele sairia do ponto.
  caixa.style.setProperty("transform", "none", "important");
  const esquerda = !ladoDe(posicao).direita;
  caixa.style.setProperty("flex-direction", esquerda ? "row-reverse" : "row", "important");
  if (interno) {
    interno.style.setProperty("left", esquerda ? "0" : "auto", "important");
    interno.style.setProperty("right", esquerda ? "auto" : "0", "important");
  }
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
      posicionar(lerPosicao("vlibras"));
      // O tamanho que conta é o do botão fixo na tela (o quadro da versão 7 é só o hospedeiro, sem tamanho).
      const medida = () => (botaoDoVLibras() ?? quadro).getBoundingClientRect();
      const antigo = quadro.querySelector<HTMLElement>("[vw-access-button]");
      if (antigo) antigo.style.touchAction = "none";
      else botaoDoVLibras()?.style.setProperty("touch-action", "none");
      soltarArrasto = arrastavel(quadro, {
        // Versão antiga: só o botão azul arrasta (dentro do avatar, arrastar é do tradutor). Na versão 7 o quadro é só o
        // botão (o avatar é outra peça, com o arrasto dele), e o evento chega com o alvo no próprio quadro.
        podeComecar: (alvo) => !antigo || (alvo instanceof Element && Boolean(alvo.closest("[vw-access-button]"))),
        mover: (x, y) => {
          const r = medida();
          posicionar(posicaoDoPonto(x, y, Math.min(r.width, r.height), r.height));
        },
        soltar: (x, y) => {
          const r = medida();
          gravarPosicao("vlibras", posicaoDoPonto(x, y, Math.min(r.width, r.height), r.height));
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
    posicionar(posicao);
  }, [ligado, posicao]);

  return null;
}
