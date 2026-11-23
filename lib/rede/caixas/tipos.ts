// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos das caixas anônimas (o contrato da frente das caixas com as outras frentes da R2).
// Sem "@/" de propósito.

/** Uma caixa: identificador, passe de depósito e passe de leitura, de 32 bytes cada, sorteados no aparelho. */
export interface Caixa {
  id: Uint8Array;
  pd: Uint8Array;
  pl: Uint8Array;
  /** Caixa de vários leitores (grupos): o pacote fica até a caixa vencer; na de um leitor só, sai quando quem lê confirma. */
  multi: boolean;
}

/** Um pacote buscado. `dia` é só a data (UTC). `marca` é a marca do servidor da franquia (denúncia com prova). */
export interface Pacote {
  ordem: number;
  envelope: Uint8Array;
  franquia: Uint8Array | null;
  marca: Uint8Array | null;
  unico: boolean;
  dia: string;
}

export type ResultadoDoDeposito = { ok: true; marca?: Uint8Array; dia?: string } | { ok: false; erro: "ocupada" | "tamanho" | "cheia" | "rede" };

/** Um aparelho no diretório (as chaves públicas, cada uma assinada; quem lê confere as assinaturas no aparelho). */
export interface AparelhoPublico {
  aparelho: Uint8Array;
  certificado: Uint8Array;
  proteusImpressao: Uint8Array;
  xwingSemana: Uint8Array;
  xwingAssinatura: Uint8Array;
  semana: number;
  criadoDia?: string;
}

/** A parte pública da conta no diretório. */
export interface ContaPublica {
  identidade: Uint8Array;
  pedidosXwing: Uint8Array;
  pedidosAssinatura: Uint8Array;
  /** A caixa de pedidos (id e passe de depósito públicos de propósito). */
  pedidosCaixa: Uint8Array;
  pedidosPd: Uint8Array;
  votoXwing: Uint8Array | null;
  votoAssinatura: Uint8Array | null;
}

export interface DiretorioDaConta extends ContaPublica {
  usuario: string;
  versao: number;
  aparelhos: AparelhoPublico[];
}

/** O que o diretório entrega a quem reivindica: uma pré-chave Proteus (ou um pacote MLS) por aparelho, com a assinatura. */
export interface PreChaveEntregue {
  aparelho: Uint8Array;
  pre: Uint8Array;
  /** A assinatura da pré-chave pela chave do aparelho (só no Proteus; o pacote MLS já vem assinado pela biblioteca). */
  assinatura: Uint8Array | null;
  id?: number;
  ref?: Uint8Array;
}
