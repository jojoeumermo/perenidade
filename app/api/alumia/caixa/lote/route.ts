// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Criar caixa e depositar pacote nas caixas anônimas (supabase/migracoes/20261124-r2-caixas.sql, public.rede_caixa_lote).
//   POST {itens:[{acao:'criar', id, pd_h, pl_h, multi}]}                  com Authorization: PrivateToken (um passe por caixa criada)
//   POST {itens:[{acao:'depositar', id, pd, envelope, franquia?, unico?}]} sem passe (o passe de depósito e o teto por caixa bastam)
//   → {resultados:[{ok, marca?, dia?} | {ok:false, erro}]}
// SEM sessão de conta: pedido com cookie de sessão ou outro Authorization é recusado. O identificador cru da caixa e os passes saem da
// memória ao fim do pedido; o banco recebe só o resumo do identificador e o passe de depósito (que ele resume). Depósito com passe
// errado (ou em caixa que não existe) responde igual ao certo, com uma marca: ela prende o resumo do passe APRESENTADO, então não
// serve de prova para a declaração de quem escreve (lib/rede/franquia/protocolo.ts).
import { deB64u, paraB64, paraB64u, resumo, ROTULOS } from "@/lib/rede/caixas/base";
import { marcaDoServidor, segredoDaFranquia } from "@/lib/rede/caixas/franquia-servidor";
import { type ItemDoLote, juntador, lerCorpo, recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { CORPO_MAXIMO_DO_LOTE, tamanhoAceito } from "@/lib/rede/caixas/tamanhos";
import { conferirPasse } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const corpo = await lerCorpo(pedido, CORPO_MAXIMO_DO_LOTE);
  const itens = Array.isArray(corpo?.itens) ? (corpo.itens as unknown[]) : null;
  if (!itens || itens.length < 1 || itens.length > 4) return responder({ ok: false, erro: "invalido" }, 400);
  const criacoes = itens.filter((x) => (x as { acao?: unknown })?.acao === "criar").length;
  // Uma caixa criada por pedido: cada criação gasta um passe, e o cabeçalho leva um só.
  if (criacoes > 1 || (criacoes === 1 && itens.length > 1)) return responder({ ok: false, erro: "invalido" }, 400);

  const segredoFranquia = segredoDaFranquia();
  const montados: ((dia: string) => { item: ItemDoLote; marca: Uint8Array | null })[] = [];
  for (const bruto of itens) {
    const x = bruto as Record<string, unknown>;
    if (x?.acao === "criar") {
      const id = deB64u(x.id, 32), pdH = deB64u(x.pd_h, 32), plH = deB64u(x.pl_h, 32);
      if (!id || !pdH || !plH || typeof x.multi !== "boolean") return responder({ ok: false, erro: "invalido" }, 400);
      const passe = await conferirPasse(pedido.headers.get("authorization"));
      if (!passe.ok) return responder({ ok: false, erro: passe.motivo === "sem_servico" ? "sem_servico" : "passe" }, passe.motivo === "sem_servico" ? 503 : 401);
      const multi = x.multi;
      montados.push(() => ({ item: { acao: "criar", id_h: paraB64(resumo(ROTULOS.caixa, id)), pd_h: paraB64(pdH), pl_h: paraB64(plH), multi, gastos: [paraB64(passe.resumo)] }, marca: null }));
    } else if (x?.acao === "depositar") {
      const id = deB64u(x.id, 32), pd = deB64u(x.pd, 32), envelope = deB64u(x.envelope);
      const franquia = x.franquia === undefined || x.franquia === null ? null : deB64u(x.franquia, 32);
      if (!id || !pd || !envelope || (x.franquia != null && !franquia) || (x.unico !== undefined && typeof x.unico !== "boolean")) {
        return responder({ ok: false, erro: "invalido" }, 400);
      }
      if (!tamanhoAceito(envelope.length)) return responder({ ok: false, erro: "tamanho" }, 400);
      const idH = resumo(ROTULOS.caixa, id);
      const pdH = resumo(ROTULOS.passeDeposito, pd);
      const unico = x.unico === true;
      montados.push((dia) => {
        const marca = franquia && segredoFranquia ? marcaDoServidor(segredoFranquia, franquia, idH, pdH, dia) : null;
        return { item: { acao: "depositar", id_h: paraB64(idH), pd: paraB64(pd), envelope: paraB64(envelope), franquia: franquia ? paraB64(franquia) : null, marca: marca ? paraB64(marca) : null, unico }, marca };
      });
    } else {
      return responder({ ok: false, erro: "invalido" }, 400);
    }
  }

  const j = juntador();
  const resultados = await Promise.all(
    montados.map(async (montar) => {
      let marca: Uint8Array | null = null;
      const { dia, resultado } = j.juntar((d) => {
        const m = montar(d);
        marca = m.marca;
        return m.item;
      });
      const r = await resultado;
      const m = marca as Uint8Array | null;
      return r.ok ? { ok: true, ...(m ? { marca: paraB64u(m), dia } : {}) } : r;
    }),
  );
  return responder({ resultados });
}
