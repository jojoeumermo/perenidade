// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pré-carregar a próxima tela da Alumia (Prompt 5, A17): quando a pessoa mostra intenção (o dedo encosta, o mouse passa, o teclado
// chega no cartão), a página da conversa e o pedaço de código dela começam a descer, e o toque abre na hora. Uma vez por endereço.
// Quem economiza dados (o modo leve, o "Economizar dados" do celular, rede 2G/3G) não paga por isso: nada é pré-carregado, como no
// <Link> do site (components/Link.tsx).

type Conexao = { saveData?: boolean; effectiveType?: string };

/** A pessoa economiza dados? (modo leve, Save-Data, 2G/3G) */
export function economizandoDados(): boolean {
  if (typeof document === "undefined") return true;
  const c = (navigator as { connection?: Conexao }).connection;
  return document.documentElement.hasAttribute("data-light") || c?.saveData === true || /(^|-)(2g|3g)$/.test(c?.effectiveType ?? "");
}

const feitos = new Set<string>();
/** Quantos endereços a memória guarda (depois disso recomeça: pré-carregar de novo só custa um pedido que o cache já atende). */
const LIMITE = 200;

/**
 * Pré-carrega a tela de `href` (o pedido da página no roteador do Next) e, se dado, o pedaço de código dela. Nunca lança; nada faz
 * no modo de economia ou se o endereço já foi pré-carregado nesta aba.
 */
export function precarregarTela(roteador: { prefetch: (href: string) => void }, href: string, pedaco?: () => Promise<unknown>): boolean {
  if (!href || feitos.has(href) || economizandoDados()) return false;
  if (feitos.size >= LIMITE) feitos.clear();
  feitos.add(href);
  try {
    roteador.prefetch(href);
  } catch {
    // sem pré-carga: o toque abre como antes
  }
  pedaco?.().catch(() => undefined);
  return true;
}
