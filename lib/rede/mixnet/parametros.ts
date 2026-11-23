// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os números da mixnet (onda R3, item 2.1), num lugar só: o que o cliente da Nym recebe quando a mixnet for ligada e o que a simulação
// do observador global usa (lib/rede/mixnet/simulacao.ts). Documento: docs/rede/CHAT-PRIVADO.md ("Por onde as mensagens passam").
//
// A mixnet está DESLIGADA nesta versão (preparada; liga por configuração quando houver rede e custo). Nada aqui liga nada.
//
// O cliente escolhido é o `@nymproject/mix-fetch` 3.0.1 (sobre o `@nymproject/mix-tunnel` 0.3.1, Apache-2.0), um `fetch` que sai pela
// mixnet compartilhada da Nym até um nó de saída (IPR) e chega ao nosso HTTPS. O que ele deixa configurar está em `OPCOES_DO_NYM`
// (conferido nos tipos do pacote: `SetupMixTunnelOpts`). O atraso de cada nó e as taxas de cobertura da Nym NÃO são opções desse
// pacote: são as da própria rede. Os valores de `MODELO` abaixo são os do modelo Loopix (o que a Nym usa) com números conservadores,
// para a simulação; quando a mixnet for ligada, a simulação roda de novo com os números medidos na rede (roteiro fora do repositório).
import { CABECALHOS_DOS_APPS } from "../caixas/ritmo";

/** As opções do `setupMixTunnel` / `createMixFetch` quando a mixnet for ligada. */
export const OPCOES_DO_NYM = {
  /** O tráfego de Poisson (as mensagens de verdade saem no lugar de um pacote de um fluxo de Poisson): ligado. */
  disablePoissonTraffic: false,
  /** O tráfego de cobertura em laço e em queda: ligado. */
  disableCoverTraffic: false,
  /** TLS até o nosso servidor por dentro da mixnet (o nó de saída não lê o pedido). */
  forceTls: true,
} as const;

/** Os cabeçalhos que o cliente da mixnet manda (o pacote põe os de um navegador se a gente não puser): os mesmos dos apps (3.3). */
export const CABECALHOS_PELA_MIXNET = CABECALHOS_DOS_APPS;

/**
 * O modelo da simulação (Loopix): camadas de nós, cada nó segura cada pacote por um tempo exponencial, e cada aparelho manda pacotes
 * num fluxo de Poisson (as mensagens de verdade entram no lugar de um pacote do fluxo; sem mensagem, o pacote é cobertura).
 */
export const MODELO = {
  /** Camadas de mixagem (a Nym usa 3) e nós por camada. */
  camadas: 3,
  nosPorCamada: 3,
  /** O atraso médio em cada nó (segundos). */
  atrasoMedio: 0.1,
  /** A taxa do fluxo de Poisson de cada aparelho (pacotes por segundo), já contando cobertura e mensagens. */
  taxaPorAparelho: 10,
} as const;
