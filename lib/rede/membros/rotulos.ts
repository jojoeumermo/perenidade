// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os rótulos dos grupos com membros escondidos: um por finalidade, para nenhuma chave servir a duas coisas. A lista de todos os
// rótulos do chat (lib/rede/cifra/rotulos.ts) importa esta, e o teste confere que nenhum se repete.

export const ROTULOS = {
  /** Segredos tirados do exportador do MLS a cada época (HKDF-SHA-256, sal = id do grupo). */
  grupo: {
    caixa: "alumia/r2/grupo/caixa/v1",
    deposito: "alumia/r2/grupo/deposito/v1",
    leitura: "alumia/r2/grupo/leitura/v1",
    embrulho: "alumia/r2/grupo/embrulho/v1",
    post: "alumia/r2/grupo/post/v1",
    voz: "alumia/r2/grupo/voz/v1",
  },
  /** O chat da equipe usa o mesmo módulo, com outros rótulos (outra chave). */
  equipe: {
    caixa: "alumia/r2/equipe/caixa/v1",
    deposito: "alumia/r2/equipe/deposito/v1",
    leitura: "alumia/r2/equipe/leitura/v1",
    embrulho: "alumia/r2/equipe/embrulho/v1",
    post: "alumia/r2/equipe/post/v1",
    voz: "alumia/r2/equipe/voz/v1",
  },
  /** Certificado da folha: a identidade da conta diz "esta folha do MLS sou eu, neste grupo". */
  folha: "alumia/r2/folha/v1",
  /** A lista de papéis (mediação), encadeada desde quem criou o grupo. */
  papeis: "alumia/r2/grupo/papeis/v1",
  /** A autorização que vai junto de cada commit. */
  commit: "alumia/r2/grupo/commit/v1",
  /** O pacote de boas-vindas (Welcome, papéis e apresentações) assinado por quem pôs a pessoa no grupo. */
  boasVindas: "alumia/r2/grupo/boas-vindas/v1",
  /** O pedido de entrada (HPKE X-Wing para a chave de entrada do núcleo). */
  entrada: "alumia/r2/grupo/entrada/v1",
  /** O repasse da chave de entrada a quem vira mediação (HPKE X-Wing para a chave da folha). */
  chaveDeEntrada: "alumia/r2/grupo/chave-entrada/v1",
  /** O passe de gestão do núcleo (atualizar a caixa de entrada no servidor sem dizer quem é). */
  gestao: "alumia/r2/grupo/gestao/v1",
  /** A entrada pública do núcleo (caixa, passe de depósito, chave X-Wing), assinada pela chave de gestão do núcleo. */
  entradaPublica: "alumia/r2/grupo/entrada-publica/v1",
  /** Os posts restritos (p2) cifrados com a chave da época. */
  postP2: "alumia/r2/grupo/post-p2/v1",
} as const;

/** Todos os rótulos desta frente, numa lista (para a conferência de que nenhum se repete). */
export const LISTA_DE_ROTULOS: readonly string[] = [
  ...Object.values(ROTULOS.grupo),
  ...Object.values(ROTULOS.equipe),
  ROTULOS.folha,
  ROTULOS.papeis,
  ROTULOS.commit,
  ROTULOS.boasVindas,
  ROTULOS.entrada,
  ROTULOS.chaveDeEntrada,
  ROTULOS.gestao,
  ROTULOS.entradaPublica,
  ROTULOS.postP2,
];
