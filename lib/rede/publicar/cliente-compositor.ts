// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do compositor da onda 12 (12A) ao banco: supabase/migracoes/20261118-alumia-o12-compositor.sql. Num banco sem a
// migração a chamada falha (função inexistente) e a tela diz que ainda não dá, sem fingir. Sem "@/" de propósito.
import { chamar, type Chamar } from "../cliente";
import type { Post } from "../tipos";
import type { Agendado, MidiaEnviada, OpcoesDeAgendar, PedidoComVida } from "../tipos-publicar";
import type { Arranjo } from "./compositor";
import type { NomeDaFigurinha } from "./figurinhas";

/** Uma imagem com a legenda que aparece embaixo dela (até 280 letras). */
export interface MidiaComLegenda extends MidiaEnviada {
  legenda?: string;
}

/** O que o compositor acrescenta ao pedido de publicar. */
export interface EscolhasDoCompositor {
  arranjo?: Arranjo;
  figurinha?: NomeDaFigurinha;
  /** O post é só a figurinha (o texto é o nome dela). */
  so_figurinha?: boolean;
}

export type PedidoDoCompositor = Omit<PedidoComVida, "midia"> & EscolhasDoCompositor & { midia?: MidiaComLegenda[] };

/** Um bloco do fio (o primeiro leva também o que está fora de `blocos`: público, comunidade, roda, prazo…). */
export interface BlocoDoFio extends EscolhasDoCompositor {
  texto: string;
  midia?: MidiaComLegenda[];
  previa?: PedidoComVida["previa"];
}

/** As escolhas gravadas num post, como o cartão recebe (rede_pub_o12_extras). */
export interface EscolhasDoPost {
  arranjo: Arranjo;
  figurinha?: NomeDaFigurinha;
  so_figurinha?: boolean;
  /** id da imagem → legenda. */
  legendas?: Record<string, string>;
}

export function criarClienteDoCompositor(c: Chamar) {
  return {
    /** Publicar com arranjo, legendas e figurinha (por cima da função da onda 9, que confere todo o resto). */
    publicar: (pedido: PedidoDoCompositor) => c<Post & { o12?: Partial<EscolhasDoPost> }>("rede_pub_o12_publicar", { p: pedido }),
    /** O fio de uma vez: de 2 a 10 blocos, tudo ou nada. `esperando`: blocos guardados até a mediação ler o de cima. */
    fio: (pedido: Omit<PedidoDoCompositor, "texto"> & { blocos: BlocoDoFio[] }) => c<{ ids: string[]; posts: Post[]; esperando: number }>("rede_pub_o12_fio", { p: pedido }),
    /** O Desfazer dos 10 s para o fio inteiro (do último bloco ao primeiro; tudo ou nada). */
    desfazerFio: (ids: string[]) => c<{ desfeito: boolean; blocos: number }>("rede_pub_o12_fio_desfazer", { p_ids: ids.slice(0, 10) }),
    /** Agendar no fuso escolhido: `local` é o dia e a hora como a pessoa escreveu ('2026-11-20T18:30'). */
    agendar: (pedido: PedidoDoCompositor, local: string | null, fuso: string | null, opcoes: OpcoesDeAgendar) =>
      c<{ id: string; quando: string; fuso: string | null }>("rede_pub_o12_agendar", { p: pedido, p_local: local, p_fuso: fuso, p_opcoes: opcoes }),
    /** A fila das agendadas, com o fuso de cada uma. */
    agendados: () => c<(Agendado & { fuso?: string | null })[]>("rede_pub_o12_agendados"),
    /** Por lote (até 50 ids): as escolhas do compositor de cada post (só os que têm alguma). */
    extras: (ids: string[]) => c<Record<string, EscolhasDoPost>>("rede_pub_o12_extras", { p_ids: ids.slice(0, 50) }),
  };
}

export const redeCompositor = criarClienteDoCompositor(chamar);
