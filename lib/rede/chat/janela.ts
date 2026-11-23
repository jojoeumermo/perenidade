// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A janela flutuante do chat (recurso "alumia-chat-flutuante"): a decisão, sem tela, para os testes rodarem no Node. A janela é só
// uma casca por cima das mesmas peças da página Conversas (components/rede/chat/janela/): nenhum protocolo novo, nenhuma chave e
// nenhuma mensagem passam por aqui. O estado (aberta, minimizada, quais conversas estão abertas) mora SÓ na memória da aba: nada vai
// ao servidor nem ao disco, e some ao recarregar, no "Sair rápido" (que sai da página) e no "apagar tudo do chat".
//
// Sem "@/" de propósito: os testes rodam este arquivo direto no Node.

/** Uma conversa aberta na janela: o id da conversa a dois e se está minimizada (só a barra com o nome). */
export interface ConversaNaJanela {
  id: string;
  minimizada: boolean;
}

export interface EstadoDaJanela {
  /** A janela está aberta (lista visível ou minimizada). Fechada, só o botão no canto. */
  aberta: boolean;
  /** A lista está recolhida no botão do canto (as conversas abertas continuam). */
  minimizada: boolean;
  /** As conversas abertas, da mais nova para a mais antiga. */
  conversas: ConversaNaJanela[];
}

export const JANELA_FECHADA: EstadoDaJanela = { aberta: false, minimizada: false, conversas: [] };

export type AcaoDaJanela =
  | { tipo: "abrir" }
  | { tipo: "minimizar" }
  | { tipo: "fechar" }
  | { tipo: "abrirConversa"; id: string; cabem: number }
  | { tipo: "minimizarConversa"; id: string }
  | { tipo: "restaurarConversa"; id: string; cabem: number }
  | { tipo: "fecharConversa"; id: string }
  | { tipo: "caber"; cabem: number }
  | { tipo: "esquecer" };

/** No máximo três conversas ao mesmo tempo (as que não cabem lado a lado saem; a lista continua tendo todas). */
export const MAXIMO_DE_CONVERSAS = 3;
/** Larguras (px) da janela no computador: a lista e cada conversa, e o respiro entre elas e da borda. */
export const LARGURA_DA_LISTA = 340;
export const LARGURA_DA_CONVERSA = 380;
export const RESPIRO = 12;
/** Abaixo disto (o celular e o tablet em pé), a janela ocupa a tela inteira e mostra uma coisa por vez. */
export const TELA_CHEIA_ATE = 768;
/**
 * Do computador em diante (1024 px) a Alumia tem a coluna do menu à esquerda, com o Escrever e o "Sair rápido" no pé: as conversas
 * lado a lado nunca avançam sobre ela (o "Sair rápido" tem de estar sempre à mão).
 */
export const COLUNA_DO_MENU = 260;
export const COLUNA_DO_MENU_DESDE = 1024;

/** A janela ocupa a tela inteira nesta largura? */
export function telaCheia(largura: number): boolean {
  return largura < TELA_CHEIA_ATE;
}

/** Quantas conversas cabem lado a lado, ao lado da lista, nesta largura (no celular, uma: a tela inteira). */
export function conversasQueCabem(largura: number): number {
  if (telaCheia(largura)) return 1;
  const reserva = largura >= COLUNA_DO_MENU_DESDE ? COLUNA_DO_MENU : 0;
  const sobra = largura - reserva - LARGURA_DA_LISTA - RESPIRO * 3;
  return Math.max(1, Math.min(MAXIMO_DE_CONVERSAS, Math.floor(sobra / (LARGURA_DA_CONVERSA + RESPIRO))));
}

/** Mantém só as `cabem` mais novas que não estão minimizadas (as minimizadas ocupam só a barra e não contam). */
function caber(conversas: ConversaNaJanela[], cabem: number): ConversaNaJanela[] {
  let abertas = 0;
  return conversas.filter((c) => {
    if (c.minimizada) return true;
    abertas += 1;
    return abertas <= Math.max(1, cabem);
  }).slice(0, MAXIMO_DE_CONVERSAS);
}

export function janela(estado: EstadoDaJanela, acao: AcaoDaJanela): EstadoDaJanela {
  switch (acao.tipo) {
    case "abrir":
      return { ...estado, aberta: true, minimizada: false };
    case "minimizar":
      return estado.aberta ? { ...estado, minimizada: true } : estado;
    case "fechar":
      // Fechar a janela fecha também as conversas abertas nela (nada fica guardado).
      return JANELA_FECHADA;
    case "abrirConversa": {
      const resto = estado.conversas.filter((c) => c.id !== acao.id);
      return { aberta: true, minimizada: estado.minimizada, conversas: caber([{ id: acao.id, minimizada: false }, ...resto], acao.cabem) };
    }
    case "restaurarConversa": {
      const resto = estado.conversas.filter((c) => c.id !== acao.id);
      if (resto.length === estado.conversas.length) return estado;
      return { ...estado, conversas: caber([{ id: acao.id, minimizada: false }, ...resto], acao.cabem) };
    }
    case "minimizarConversa":
      return { ...estado, conversas: estado.conversas.map((c) => (c.id === acao.id ? { ...c, minimizada: true } : c)) };
    case "fecharConversa":
      return { ...estado, conversas: estado.conversas.filter((c) => c.id !== acao.id) };
    case "caber":
      return { ...estado, conversas: caber(estado.conversas, acao.cabem) };
    case "esquecer":
      return JANELA_FECHADA;
  }
}

/**
 * A janela não aparece na própria página Conversas (lá o chat já ocupa a tela; duas cópias da mesma conversa abertas
 * disputariam a caixa e as não lidas). `caminho` é o pathname: /<idioma>/alumia/conversas, com ou sem barra no fim.
 */
export function naPaginaDasConversas(caminho: string | null | undefined): boolean {
  return /^\/[a-z]{2}\/alumia\/conversas\/?$/.test(caminho ?? "");
}
