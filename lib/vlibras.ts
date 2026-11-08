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

/**
 * O que o tradutor põe na página. Na versão 7 (conferido em 08/11/2026 com a v7.12.2) são duas peças soltas no fim do
 * <body>: "#vlibras-access-wrapper", o botão azul com a mão (dentro de uma shadow root aberta, onde o elemento que fica
 * fixo na tela é "#vlibras-access"), e "#vlibras-app-root", a janela do avatar, que só aparece depois do primeiro clique
 * no botão. A versão antiga usava um único "div[vw]"; ele continua aceito, caso o governo volte ao formato antigo.
 */
export const quadroDoVLibras = () => document.getElementById("vlibras-access-wrapper") ?? document.querySelector<HTMLElement>("div[vw]");

/** O elemento do botão que fica fixo na tela (o que se move para trocar o botão de lugar). */
export function botaoDoVLibras(): HTMLElement | null {
  const quadro = quadroDoVLibras();
  return quadro?.shadowRoot?.getElementById("vlibras-access") ?? quadro;
}

/** A janela do avatar (versão 7), quando a pessoa já abriu. */
const janelaDoVLibras = () => document.getElementById("vlibras-app-root");

// Desligado: as peças saem da página e ficam guardadas aqui, para voltar sem baixar nada se a pessoa ligar de novo.
let guardadas: HTMLElement[] = [];

/** Baixa o programa do VLibras e liga o tradutor (ele põe o próprio botão na lateral da tela). Uma vez por visita. */
export function carregarVLibras(): Promise<void> {
  if (pedido && desligado) {
    // Já baixado nesta visita e desligado: só volta a aparecer (nada é baixado de novo).
    desligado = false;
    pararDeVigiar();
    for (const peca of guardadas) if (!peca.isConnected) document.body.appendChild(peca);
    guardadas = [];
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
        // O tradutor põe o botão na página um instante depois (setTimeout ou DOMContentLoaded): "ligado" só com ele lá,
        // para "Desligar" e "mudar de lugar" acharem o que tirar ou mover.
        const inicio = Date.now();
        const esperar = () => (quadroDoVLibras() || Date.now() - inicio > 3000 ? resolve() : window.setTimeout(esperar, 50));
        esperar();
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
 * fecha o avatar, tira da página o botão azul e a janela do avatar e esquece o "lembrar neste aparelho", para ele não
 * voltar sozinho na próxima página. Uma página nova (ou recarregar) não baixa mais nada de vlibras.gov.br até a pessoa
 * ativar de novo; ligar de novo nesta mesma página só devolve as peças guardadas.
 */
export function desligarVLibras() {
  desligado = true;
  lembrarVLibras(false);
  const janela = janelaDoVLibras();
  // Fecha o avatar antes de tirar da página (o próprio botão do tradutor abre pondo data-active="true").
  if (janela) janela.dataset.active = "false";
  try {
    // O tradutor reabre sozinho o avatar na próxima carga se ele ficou aberto: fica fechado.
    const estado = localStorage.getItem("@vlibras-widget");
    if (estado?.includes('"isOpen":true')) localStorage.setItem("@vlibras-widget", estado.replace('"isOpen":true', '"isOpen":false'));
  } catch {
    // sem armazenamento: nada a fazer
  }
  recolher(janela);
  vigiarDepoisDeDesligar();
  avisar();
}

/** Tira da página as peças do tradutor que estiverem nela e guarda para quando a pessoa ligar de novo. */
function recolher(janela = janelaDoVLibras()) {
  for (const peca of [quadroDoVLibras(), janela]) {
    if (!peca) continue;
    if (peca === janela) peca.dataset.active = "false";
    peca.remove();
    if (!guardadas.includes(peca)) guardadas.push(peca);
  }
}

// Quanto tempo vigiar a página depois de desligar: o bastante para o aplicativo do avatar terminar de baixar.
const VIGIA_MS = 20000;
let vigia: { observador: MutationObserver; prazo: number } | null = null;

function pararDeVigiar() {
  if (!vigia) return;
  vigia.observador.disconnect();
  window.clearTimeout(vigia.prazo);
  vigia = null;
}

/**
 * Se a pessoa clicou no botão azul e desligou antes de o aplicativo do avatar (vlibras-plugin-app.js) acabar de
 * baixar, a janela do avatar só chega depois, e o tradutor a abre (data-active="true") quando o script termina. Por
 * um tempo depois de desligar, o que o tradutor puser de volta na página sai e fica guardado junto com o resto.
 */
function vigiarDepoisDeDesligar() {
  pararDeVigiar();
  const observador = new MutationObserver(() => {
    if (!desligado) return pararDeVigiar();
    if (janelaDoVLibras() || quadroDoVLibras()) recolher();
  });
  observador.observe(document.body, { childList: true });
  vigia = { observador, prazo: window.setTimeout(pararDeVigiar, VIGIA_MS) };
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
