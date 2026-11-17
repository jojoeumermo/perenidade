// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O desafio da porta de entrada da Alumia (supabase/migracoes/20261114-alumia-o8-porta.sql, lib/rede/convites/prova.ts).
//   POST {momento: "conta" | "pedido" | "entrar" | "aviso"} → {desafio, dificuldade, vence}
// A dificuldade sobe com a pressão: o banco diz quantas vezes esta rede passou nesta hora (pelo resumo do freio, que muda de hora
// em hora) e, na conta e no pedido, quantos a casa recebeu nesta hora. Sem banco, a dificuldade de cautela. Nada é gravado aqui.
// "entrar" e "aviso" (onda 9: entrar, reenviar a confirmação e pedir a senha nova sem o desafio de terceiros) não têm teto da casa
// nem o balde único de quem chega sem impressão: num ataque, quem já tem conta continua entrando.
import { chaveDoFreio, emitirDesafio } from "@/lib/rede/convites/prova-servidor";
import { DIFICULDADE_BASE, DIFICULDADE_MAXIMA, dificuldadeDaPressao, MOMENTOS, MOMENTOS_SEM_TETO, type MomentoDaPorta, type PressaoDaPorta } from "@/lib/rede/convites/prova";
import { criarFreio, deOutraOrigem, impressaoDoFreio, impressaoDoPedido, resposta, rpcDeServico, semImpressaoEmProducao } from "@/lib/rede/convites/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Emitir é barato, mas não de graça: 40 desafios por rede a cada 10 minutos.
const freio = criarFreio(40, 10 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  const corpo = (await pedido.json().catch(() => null)) as { momento?: unknown } | null;
  const momento = (MOMENTOS as readonly unknown[]).includes(corpo?.momento) ? (corpo?.momento as MomentoDaPorta) : null;
  if (!momento) return resposta({ ok: false, motivo: "invalido" }, 400);
  const impressao = impressaoDoPedido(pedido);
  if (!freio(impressao ?? "sem-rede")) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  if (MOMENTOS_SEM_TETO.includes(momento)) {
    const r = await rpcDeServico<{ rede: number }>("alumia_porta_pressao", { p_chave: chaveDoFreio(impressao, momento), p_momento: momento });
    const dificuldade = semImpressaoEmProducao(impressao) ? DIFICULDADE_MAXIMA : DIFICULDADE_BASE + Math.max(0, Math.min(4, Math.floor(Number(r.ok ? r.dado.rede : 0) || 0)));
    return resposta({ ok: true, ...emitirDesafio(momento, dificuldade) });
  }
  const chave = chaveDoFreio(impressaoDoFreio(impressao), momento);
  const r = await rpcDeServico<PressaoDaPorta>("alumia_cadastro_pressao", { p_chave: chave, p_momento: momento });
  // Sem impressão em produção (sem a borda na frente), o desafio mais difícil: e o freio é o balde único de quem chega assim.
  const desafio = emitirDesafio(momento, semImpressaoEmProducao(impressao) ? DIFICULDADE_MAXIMA : dificuldadeDaPressao(r.ok ? r.dado : null));
  return resposta({ ok: true, ...desafio });
}
