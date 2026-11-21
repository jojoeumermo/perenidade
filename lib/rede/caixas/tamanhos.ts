// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tamanhos fixos dos pacotes nas caixas anônimas (o banco recusa qualquer outro: interno.caixa_tamanho_ok, conferido contra esta
// lista em scripts/testar-r2-caixas-cliente.mjs). Tamanho fixo é o que impede o servidor de adivinhar o que vai dentro pelo tamanho.
// Sem "@/" de propósito.

/** O encapsulamento do X-Wing (o `enc` do HPKE) e a etiqueta do AEAD. */
export const XWING_ENC = 1120;
export const ETIQUETA = 16;
/** O cabeçalho do embrulho de grupo: 0x47, versão, época (u64) e o nonce de 24 bytes. */
export const CABECALHO_GRUPO = 34;

/** Os blocos de dentro da conversa a dois (antes do envelope). */
export const BLOCOS_DUPLA = [2048, 4096, 8192, 16384, 24576, 32768] as const;
/** Os blocos de dentro do embrulho de grupo. */
export const BLOCOS_GRUPO = [2048, 8192, 32768, 131072] as const;

/** Envelope da conversa a dois: enc(1120) ‖ cifrado(n + 16). */
export const TAMANHOS_DUPLA: readonly number[] = BLOCOS_DUPLA.map((n) => XWING_ENC + n + ETIQUETA);
/** Embrulho de grupo: cabeçalho(34) ‖ cifrado(n + 16). */
export const TAMANHOS_GRUPO: readonly number[] = BLOCOS_GRUPO.map((n) => CABECALHO_GRUPO + n + ETIQUETA);
/** Pedido de conversa: HPKE X-Wing com o cifrado completado a 4096 (o mesmo tamanho de uma mensagem curta da conversa a dois). */
export const TAMANHO_PEDIDO = XWING_ENC + 4096 + ETIQUETA;
/** Canal de ligar aparelho: HPKE X-Wing completado a 65536. */
export const TAMANHO_LIGAR = XWING_ENC + 65536 + ETIQUETA;

/** Todos os tamanhos que o banco aceita num depósito. */
export const TAMANHOS_ACEITOS: readonly number[] = [...new Set([...TAMANHOS_DUPLA, ...TAMANHOS_GRUPO, TAMANHO_PEDIDO, TAMANHO_LIGAR])].sort((a, b) => a - b);

/** O maior pacote (em bytes) e o corpo máximo de um pedido à rota do lote (base64 e folga para até 4 itens pequenos). */
export const MAIOR_PACOTE = Math.max(...TAMANHOS_ACEITOS);
export const CORPO_MAXIMO_DO_LOTE = 192 * 1024;
/** O corpo máximo das outras rotas anônimas. */
export const CORPO_MAXIMO = 16 * 1024;

export const tamanhoAceito = (n: number): boolean => TAMANHOS_ACEITOS.includes(n);
