// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os rótulos da conversa a dois e dos aparelhos (onda R2): um por finalidade, para que uma chave, assinatura ou resumo de um uso
// nunca valha em outro. A lista de todas as frentes junta estes em lib/rede/cifra/rotulos.ts, e o teste da junção confere que
// nenhum se repete. Documento: docs/rede/CHAT-PRIVADO.md.
//
// Os rótulos que esta frente USA mas que são de outras (o resumo da caixa e o do passe, da frente das caixas; a franquia e a
// declaração de quem escreve, da frente da denúncia) ficam em ROTULOS_DE_FORA, com os mesmos bytes de lá: não entram na lista desta
// frente, para a conferência da junção não os contar duas vezes.
export const ROTULOS_DE_FORA = {
  /** Resumo do identificador da caixa (lib/rede/caixas: id_h = SHA-256(rótulo ‖ 0 ‖ campo(id))). */
  caixa: "alumia/r2/caixa",
  /** Resumo do passe de depósito (lib/rede/caixas: pd_h). */
  passeDeposito: "alumia/r2/passe-deposito",
  /** Resumo do passe de leitura (lib/rede/caixas: pl_h). */
  passeLeitura: "alumia/r2/passe-leitura",
  /** Compromisso da franquia (lib/rede/caixas/franquia.ts, ROTULOS.franquia). */
  franquia: "alumia/r2/franquia/v1",
  /** HPKE (info) do pedido de conversa (lib/rede/caixas/base.ts, ROTULOS.pedido). */
  pedido: "alumia/r2/pedido/v1",
  /** Declaração de quem escreve: "o passe de depósito desta caixa é meu" (lib/rede/caixas/franquia.ts, ROTULOS.remetente). */
  declaracao: "alumia/r2/franquia/remetente/v1",
} as const;

export const ROTULOS = {
  /** HPKE (info) do envelope de cada mensagem para a chave X-Wing da semana do aparelho de destino. */
  envelope: "alumia/r2/envelope/v1",
  /** Resumo de um bloco, para o `anterior` do seguinte. */
  bloco: "alumia/r2/bloco/v1",
  /** Certificado de um aparelho, assinado pela identidade da conta. */
  certificadoAparelho: "alumia/r2/certificado-aparelho/v1",
  /** A chave X-Wing da semana, assinada pela chave do aparelho. */
  chaveSemana: "alumia/r2/chave-semana/v1",
  /** Uma pré-chave Proteus, assinada pela chave do aparelho (o Proteus não assina pré-chave; a Alumia assina por fora). */
  preChave: "alumia/r2/pre-chave/v1",
  /** A chave de pedidos da conta, assinada pela identidade. */
  chavePedidos: "alumia/r2/chave-pedidos/v1",
  /** O código de segurança (60 algarismos). */
  codigo: "alumia/r2/codigo/v1",
  /** A assinatura da identidade de quem pede, sobre o pedido de conversa (o HPKE do modo base não diz quem fechou). */
  pedidoAssinado: "alumia/r2/pedido/assinado/v1",
  /** Da chave de sincronia da conta (HKDF): a caixa de pedidos (id, passe de leitura e o de depósito, público). */
  pedidosCaixa: "alumia/r2/conta/pedidos/caixa/v1",
  pedidosLeitura: "alumia/r2/conta/pedidos/leitura/v1",
  pedidosDeposito: "alumia/r2/conta/pedidos/deposito/v1",
  /** Da chave de sincronia da conta (HKDF): o passe de depósito das caixas de sincronia dos aparelhos da pessoa. */
  sincroniaDeposito: "alumia/r2/conta/sincronia/deposito/v1",
  /** HPKE (info) e MAC do canal de ligar aparelho (QR). */
  ligar: "alumia/r2/ligar/v1",
  /** Cópia de segurança (dados associados do arquivo cifrado). */
  copia: "alumia/r2/copia/v1",
  /** Lista de conversas sincronizada entre os aparelhos (dados associados do arquivo cifrado). */
  lista: "alumia/r2/lista/v1",
} as const;
