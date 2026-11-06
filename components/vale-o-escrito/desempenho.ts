// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Orçamento de desempenho do Vale o Escrito (docs/ACESSIBILIDADE-E-PESO.md): medir se o aparelho dá conta e, se não der,
// baixar a qualidade (menos halos, sem animação das ligações, sem calor no mapa). Nada sai do navegador: a medida é só
// local, não é guardada nem enviada (sem rastreio).

/** Sinais de aparelho fraco ou de quem pediu economia de dados (sem medir nada). */
export function aparelhoFraco(): boolean {
  try {
    const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (n.connection?.saveData) return true;
    if (typeof n.deviceMemory === "number" && n.deviceMemory <= 1) return true;
    if (typeof n.hardwareConcurrency === "number" && n.hardwareConcurrency > 0 && n.hardwareConcurrency <= 2) return true;
  } catch {}
  return false;
}

/**
 * Conta os quadros por `duracaoMs` (com a aba visível) e chama `aoMedir(fps)`. Aparelho fraco já responde 0 sem medir.
 * Devolve a função que cancela a medida.
 */
export function medirQuadros(duracaoMs: number, aoMedir: (fps: number) => void): () => void {
  let id = 0;
  let inicio = 0;
  let quadros = 0;
  let parado = false;
  if (aparelhoFraco()) {
    id = requestAnimationFrame(() => aoMedir(0));
    return () => cancelAnimationFrame(id);
  }
  const passo = (agora: number) => {
    if (parado) return;
    if (document.visibilityState !== "visible") {
      // Aba escondida: o navegador segura os quadros; recomeça a conta quando voltar.
      inicio = 0;
      quadros = 0;
    } else if (!inicio) inicio = agora;
    else {
      quadros++;
      if (agora - inicio >= duracaoMs) {
        aoMedir((quadros * 1000) / (agora - inicio));
        return;
      }
    }
    id = requestAnimationFrame(passo);
  };
  id = requestAnimationFrame(passo);
  return () => {
    parado = true;
    cancelAnimationFrame(id);
  };
}

/**
 * Para as animações (CSS) de um elemento quando ele sai da tela ou a aba fica escondida: marca `data-parado` e o CSS
 * pausa (animation-play-state). Devolve a função que solta os ouvintes.
 */
export function pausarForaDaTela(el: HTMLElement): () => void {
  let naTela = true;
  const aplicar = () => {
    if (!naTela || document.visibilityState !== "visible") el.setAttribute("data-parado", "");
    else el.removeAttribute("data-parado");
  };
  const io =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((es) => {
          naTela = es.some((e) => e.isIntersecting);
          aplicar();
        })
      : null;
  io?.observe(el);
  document.addEventListener("visibilitychange", aplicar);
  return () => {
    io?.disconnect();
    document.removeEventListener("visibilitychange", aplicar);
  };
}
