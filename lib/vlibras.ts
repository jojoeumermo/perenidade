// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O VLibras (recurso "vlibras"): o tradutor de português para Libras do Governo Federal, carregado só depois de a pessoa
// clicar em "Ativar" e confirmar o aviso de serviço externo. "Lembrar neste aparelho" (desmarcado por padrão) faz o
// tradutor carregar sozinho nas próximas páginas; é a única coisa que o site guarda sobre isso (lucia:vlibras).
//
// De onde vem: o endereço oficial, vlibras.gov.br/app. Ele entrega as páginas (o quadro do avatar, unity/index.html)
// e redireciona os scripts, estilos e imagens para o repositório oficial do governo no jsDelivr, na versão que o
// governo publica. Apontar direto para o jsDelivr não serve: ele entrega páginas HTML como texto puro, e o avatar
// ficava girando para sempre ("Não foi possível carregar o player"). A política de segurança (next.config.ts) libera,
// com o recurso ligado, só vlibras.gov.br, o caminho do repositório oficial no jsDelivr e os serviços *.vlibras.gov.br
// (tradução, dicionário). Outros destinos que o tradutor tente usar, como a métrica PostHog, continuam bloqueados.
// Conferido em 20/10/2026 com a versão v7.12.2 (ativar, abrir o avatar, traduzir um trecho).

export const ENDERECO_VLIBRAS = "https://vlibras.gov.br/app";
export const LEMBRAR_VLIBRAS = "lucia:vlibras";

type Janela = Window & { VLibras?: { Widget: new (endereco: string) => unknown }; VLibrasWidget?: { path?: string } };

let pedido: Promise<void> | null = null;
/** Desligado pela pessoa depois de ligado (T11): o programa já baixado fica escondido até ela ligar de novo. */
let desligado = false;

/** O VLibras está ligado e à vista nesta página. */
export const vlibrasCarregado = () => pedido !== null && !desligado;

/** O quadro que o tradutor põe na página (o botão azul e, aberto, o avatar). */
export const quadroDoVLibras = () => document.querySelector<HTMLElement>("div[vw]");

/** Baixa o programa do VLibras e liga o tradutor (ele põe o próprio botão na lateral da tela). Uma vez por visita. */
export function carregarVLibras(): Promise<void> {
  if (pedido && desligado) {
    // Já baixado nesta visita e desligado: só volta a aparecer (nada é baixado de novo).
    desligado = false;
    quadroDoVLibras()?.style.removeProperty("display");
    avisar();
    return pedido;
  }
  desligado = false;
  pedido ??= new Promise<void>((resolve, reject) => {
    const janela = window as Janela;
    // O programa lê daqui de onde baixar o resto (imagens e o aplicativo), em vez do endereço que redireciona.
    janela.VLibrasWidget = { ...janela.VLibrasWidget, path: ENDERECO_VLIBRAS };
    const script = document.createElement("script");
    script.src = `${ENDERECO_VLIBRAS}/vlibras-plugin.js`;
    script.async = true;
    script.onload = () => {
      try {
        if (!janela.VLibras) throw new Error("vlibras");
        new janela.VLibras.Widget(ENDERECO_VLIBRAS);
        resolve();
      } catch (erro) {
        reject(erro);
      }
    };
    script.onerror = () => reject(new Error("vlibras"));
    document.body.appendChild(script);
  }).then(avisar, (erro) => {
    pedido = null;
    throw erro;
  });
  return pedido;
}

/**
 * Desliga o VLibras de volta (T11: "hoje parece não ter volta"). O programa do governo não tem um "desligar": o site
 * esconde o quadro dele (botão e avatar) e esquece o "lembrar neste aparelho", para ele não voltar sozinho na próxima
 * página. Uma página nova (ou recarregar) não baixa mais nada de vlibras.gov.br até a pessoa ativar de novo.
 */
export function desligarVLibras() {
  desligado = true;
  lembrarVLibras(false);
  quadroDoVLibras()?.style.setProperty("display", "none", "important");
  avisar();
}

const MUDOU = "lucia:vlibras-mudou";
function avisar() {
  window.dispatchEvent(new Event(MUDOU));
}
/** Para a tela acompanhar quando o VLibras liga ou desliga (em outro ponto da página). */
export function assinarVLibras(f: () => void) {
  window.addEventListener(MUDOU, f);
  return () => window.removeEventListener(MUDOU, f);
}

export function vlibrasLembrado(): boolean {
  try {
    return localStorage.getItem(LEMBRAR_VLIBRAS) === "sempre";
  } catch {
    return false;
  }
}

export function lembrarVLibras(sim: boolean) {
  try {
    if (sim) localStorage.setItem(LEMBRAR_VLIBRAS, "sempre");
    else localStorage.removeItem(LEMBRAR_VLIBRAS);
  } catch {
    // sem armazenamento: vale só para esta página
  }
}
