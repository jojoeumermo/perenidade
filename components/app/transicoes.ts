// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Transições entre telas do aplicativo. Usa a View Transitions API (document.startViewTransition) quando existe e a
// pessoa não pediu menos movimento; sem ela, só troca a tela, sem animar (o CSS de app/app-casca.css dá o fade de
// chegada nos dois casos). Só no navegador.

export type Direcao = "avancar" | "voltar" | "aba";

/** A pessoa pediu menos movimento (sistema, ou o "Parar movimentos" do site em <html data-parado>)? */
export function semMovimento(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-parado");
  } catch {
    return true;
  }
}

type ComTransicao = Document & { startViewTransition?: (atualizar: () => Promise<void> | void) => { finished: Promise<void> } };

/**
 * Roda `atualizar` (que troca a tela e devolve uma promessa que se resolve quando a nova já está montada) dentro de uma
 * transição. `<html data-transicao="...">` diz ao CSS para que lado a tela anda. Nunca lança: se a API falhar, a
 * atualização roda mesmo assim.
 */
export function comTransicao(direcao: Direcao, atualizar: () => Promise<void> | void): Promise<void> {
  const doc = document as ComTransicao;
  if (semMovimento() || typeof doc.startViewTransition !== "function") return Promise.resolve(atualizar());
  const raiz = document.documentElement;
  raiz.setAttribute("data-transicao", direcao);
  const limpar = () => raiz.removeAttribute("data-transicao");
  try {
    return doc.startViewTransition(atualizar).finished.then(limpar, limpar);
  } catch {
    limpar();
    return Promise.resolve(atualizar());
  }
}

/** Uma promessa que se resolve quando `avisar()` for chamada (a casca chama a cada troca de endereço) ou após `limite` ms. */
export function esperarARota(limite = 700): { promessa: Promise<void>; avisar: () => void } {
  let avisar = () => {};
  const promessa = new Promise<void>((resolver) => {
    const fim = setTimeout(resolver, limite);
    avisar = () => {
      clearTimeout(fim);
      resolver();
    };
  });
  return { promessa, avisar };
}
