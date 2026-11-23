// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do compositor do prompt 4 ao banco (supabase/migracoes/20261127-p4-compositor.sql). Num banco sem a migração a chamada
// falha (função inexistente) e a tela diz que ainda não dá, sem fingir. Sem "@/" de propósito.
import { chamar, type Chamar } from "../cliente";
import type { Post } from "../tipos";
import type { OpcoesDeAgendar } from "../tipos-publicar";
import type { PedidoDoCompositor } from "./cliente-compositor";
import type { CamposDoP4, ExtrasDoP4 } from "./p4-compositor";

export type PedidoDoP4 = PedidoDoCompositor & CamposDoP4;

export function criarClienteDoP4(c: Chamar) {
  return {
    /** Publicar com versão curta, capa, convite e fonte (por cima da função da onda 12, que confere todo o resto). */
    publicar: (pedido: PedidoDoP4) => c<Post & { p4?: CamposDoP4 }>("rede_pub_p4_publicar", { p: pedido }),
    /** Agendar no fuso escolhido, com as escolhas valendo quando o post sair. */
    agendar: (pedido: PedidoDoP4, local: string | null, fuso: string | null, opcoes: OpcoesDeAgendar) =>
      c<{ id: string; quando: string; fuso: string | null }>("rede_pub_p4_agendar", { p: pedido, p_local: local, p_fuso: fuso, p_opcoes: opcoes }),
    /** Por lote (até 50 ids): o que cada post guardou (só os que têm alguma coisa). */
    extras: (ids: string[]) => c<Record<string, ExtrasDoP4>>("rede_pub_p4_extras", { p_ids: ids.slice(0, 50) }),
  };
}

export const redeP4 = criarClienteDoP4(chamar);
