// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Prompt 4, item 1: a proteção contra print, na parte que o navegador consegue fazer. O conteúdo que a autora marcou como protegido
// (o story, a foto de perfil) some quando a aba perde o foco ou a janela sai da frente; copiar, arrastar, selecionar e o menu do
// botão direito ficam desligados nele; por cima vai uma marca d'água discreta com o codinome de quem lê. Nada disto avisa a autora
// nem grava quem abriu (isso seria registro de comportamento de quem lê). O navegador não consegue barrar o print do sistema: o aviso
// fixo diz isso. As telas nativas (FLAG_SECURE no Android) ficam para os apps.
// Sem "@/" de propósito: as funções puras rodam no Node nos testes.

/** Os eventos que o conteúdo protegido recusa (copiar, recortar, arrastar, selecionar e o menu do botão direito). */
export const EVENTOS_BARRADOS = ["copy", "cut", "dragstart", "selectstart", "contextmenu"] as const;

/** O atributo que marca o conteúdo protegido (o CSS desliga a seleção e o esconde na impressão). */
export const ATRIBUTO_PROTEGIDO = "data-p4-protegido";
/** O atributo que diz que o conteúdo está escondido agora (a janela saiu da frente). */
export const ATRIBUTO_ESCONDIDO = "data-p4-escondido";

export interface EstadoDaJanela {
  /** A aba está à vista (document.visibilityState === "visible")? */
  visivel: boolean;
  /** A janela está com o foco (perdeu no "blur", voltou no "focus")? */
  foco: boolean;
  /** O navegador está imprimindo (entre "beforeprint" e "afterprint")? */
  imprimindo?: boolean;
}

/** O conteúdo protegido fica escondido quando a aba some, a janela perde o foco ou a página vai para a impressão. */
export function deveEsconder(estado: EstadoDaJanela): boolean {
  return !estado.visivel || !estado.foco || estado.imprimindo === true;
}

/** O texto da marca d'água: o codinome de quem lê, sem quebra de linha e curto (40 letras). Sem codinome, nada. */
export function textoDaMarca(codinome: string | null | undefined): string {
  const limpo = (codinome ?? "").replace(/[\s\u0000-\u001f]+/g, " ").trim();
  return [...limpo].slice(0, 40).join("");
}

/** Quantas vezes a marca se repete na camada (o bastante para cobrir a tela inteira do visor no computador). */
export const REPETICOES_DA_MARCA = 24;

/**
 * Onde a página está, para o aviso fixo dizer o limite certo: "app" no app Android da Alumia (o WebView se anuncia com "; wv)" e o
 * app já liga FLAG_SECURE nas duas telas, MainActivity e RedeActivity: o print e a gravação saem pretos), "navegador" em todo o
 * resto (a proteção é só a da página, mais fraca). Sem iPhone: o app de iPhone saiu do plano.
 */
export function plataformaDaProtecao(ua: string): "app" | "navegador" {
  return /Android/.test(ua) && /; wv\)/.test(ua) ? "app" : "navegador";
}
