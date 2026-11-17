// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 9B (moderação da comunidade). Quem junta acrescenta `moderacao` à lista de components/rede/encaixes.tsx
// (import de "./moderacao/encaixe"). Antes de publicar numa comunidade, a pessoa fica sabendo:
//   · do modo lento: quanto falta para poder postar ali de novo (para, sem gastar a tentativa);
//   · do filtro automático: se o post vai esperar a leitura da moderação, e por qual regra (avisa e deixa seguir).
// A conferência de verdade continua no banco (os gatilhos de 20261115-alumia-o9-moderacao.sql); se a consulta falhar, segue.
import { moderacaoDaComunidade, previsaoDoFiltro, tempoEscrito } from "@/lib/rede/comunidade-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosMod } from "@/lib/rede/textos-moderacao";
import type { Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../encaixes";

/** O modo lento e o filtro da comunidade, antes de publicar. Fora de comunidade, segue sem perguntar nada ao banco. */
export async function avisoDaModeracao(pedido: PedidoDePublicacao, lang: string): Promise<ResultadoAntesDePublicar> {
  if (!pedido.comunidade) return { ok: true };
  const [regras, sm] = await Promise.all([moderacaoDaComunidade.automod(pedido.comunidade), carregarTextosMod(lang)]);
  if (regras.para_mim.lento_falta > 0) {
    return { ok: false, bloqueia: true, aviso: preencher(sm.o9.antes.lento, { tempo: tempoEscrito(sm.o9.tempo, regras.para_mim.lento_falta) }) };
  }
  const motivo = previsaoDoFiltro(regras, pedido.texto);
  if (motivo) return { ok: false, aviso: preencher(sm.o9.antes.filtro, { motivo: (sm.o9.motivos as Record<string, string>)[motivo] ?? motivo }) };
  return { ok: true };
}

export const encaixe: Encaixe = {
  antesDePublicar: [(pedido, ctx) => avisoDaModeracao(pedido, ctx.lang)],
};
