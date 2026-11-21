// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os rótulos de derivação do motor de grupo MLS com o registro de commits no banco (motor-de-grupo.ts): os posts restritos "p2" e a
// voz dos núcleos e das comunidades fechadas, e o chat da equipe. Uma chave por finalidade: cada rótulo aparece uma vez só, e o
// grupo e a equipe usam rótulos diferentes (o mesmo segredo de época nunca dá a mesma chave para os dois usos). O prefixo
// "alumia/r2/mls/" separa estes rótulos dos da caixa anônima de época (rotulos.ts dos grupos com membros escondidos): a junção
// confere, em lib/rede/cifra/rotulos.ts, que nenhum rótulo se repete entre as frentes. Sem "@/": roda no Node nos testes.

export const ROTULOS = {
  grupo: {
    /** A chave do embrulho dos commits que vão ao banco. */
    embrulho: "alumia/r2/mls/grupo/embrulho/v1",
    /** A chave dos posts restritos "p2". */
    post: "alumia/r2/mls/grupo/post/v1",
    /** A base das chaves das salas de voz. */
    voz: "alumia/r2/mls/grupo/voz/v1",
  },
  equipe: {
    embrulho: "alumia/r2/mls/equipe/embrulho/v1",
    /** As mensagens da equipe (corpo "m1"), guardadas cifradas no banco para o histórico. */
    mensagem: "alumia/r2/mls/equipe/mensagem/v1",
  },
  /** A amarração do embrulho ao grupo (SHA-256 do rótulo ‖ id do grupo no MLS): um embrulho de um grupo não abre em outro. */
  amarra: "alumia/r2/mls/amarra/v1",
  /** O certificado que a identidade da pessoa da equipe assina para cada folha MLS de um aparelho dela. */
  folhaDaEquipe: "alumia/r2/mls/equipe/folha/v1",
  /** A chave de uma sala de voz, tirada da chave de voz da época com o nome da sala. */
  sala: "alumia/r2/mls/grupo/sala/v1",
  /** Os dados amarrados ao post "p2" (grupo, época, autor). */
  post: "alumia/r2/mls/grupo/post-dados/v1",
  /** Os dados amarrados à mensagem "m1" da equipe (conversa, época, contexto). */
  mensagem: "alumia/r2/mls/equipe/mensagem-dados/v1",
} as const;

/** Todos os rótulos deste motor, em lista (para o teste de não repetição). */
export const LISTA_DE_ROTULOS: readonly string[] = [
  ...Object.values(ROTULOS.grupo),
  ...Object.values(ROTULOS.equipe),
  ROTULOS.amarra,
  ROTULOS.folhaDaEquipe,
  ROTULOS.sala,
  ROTULOS.post,
  ROTULOS.mensagem,
];
