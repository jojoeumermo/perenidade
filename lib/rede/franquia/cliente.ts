// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do navegador da denúncia com prova (lib/rede/franquia/protocolo.ts): manda à rota app/api/alumia/franquia/denunciar os
// trechos que a pessoa escolheu, cada um com a prova da mensagem de onde veio. Vai COM a sessão de quem denuncia (a denúncia é dela; a caixa não vai ao banco). Recusa
// vira BackendError com o código, para a tela dizer o motivo.
import { BackendError, getClient } from "../../backend";
import { provaInteira, type PedidoDeDenunciaComProva } from "./protocolo";

export type ResultadoDaDenunciaComProva = { protocolo: string; prioridade: number; ja: boolean; responder_ate?: string };

async function token(): Promise<string> {
  const supabase = await getClient();
  const t = (await supabase.auth.getSession()).data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

export async function denunciarComProva(p: PedidoDeDenunciaComProva): Promise<ResultadoDaDenunciaComProva> {
  if (p.trechos.length === 0 || !p.trechos.every((t) => provaInteira(t.prova))) throw new BackendError("prova_nao_confere");
  let r: Response;
  try {
    r = await fetch("/api/alumia/franquia/denunciar", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(p),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    if (e instanceof BackendError) throw e;
    throw new BackendError("sem_conexao");
  }
  const dado = (await r.json().catch(() => null)) as (Record<string, unknown> & Partial<ResultadoDaDenunciaComProva>) | null;
  if (!dado?.ok) throw new BackendError(typeof dado?.motivo === "string" ? dado.motivo : r.status === 404 ? "sem_servico" : "falha");
  return { protocolo: String(dado.protocolo), prioridade: Number(dado.prioridade), ja: dado.ja === true, responder_ate: dado.responder_ate };
}
