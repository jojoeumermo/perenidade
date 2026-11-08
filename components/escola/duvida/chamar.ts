// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Chamar uma função da Escola que GRAVA (escolher a frente, levar a dúvida ao núcleo) pelo contrato
// (lib/escola/contratos.ts), guardando o código da recusa: a tela precisa dizer "o núcleo ainda não marcou a roda" e não
// só "não deu". As leituras continuam por lerDaEscola (lib/escola/acesso.ts). Na prévia de desenvolvimento, a chamada
// passa pelo lerDaEscola, que devolve "ausente" para o que a prévia não tem: nada vai ao banco.

import { BackendError, rpc } from "@/lib/backend";
import { emPrevia, lerDaEscola } from "@/lib/escola/acesso";
import type { FuncaoDaEscola, FuncoesDaEscola } from "@/lib/escola/contratos";

export type Chamada<T> = { ok: true; dados: T } | { ok: false; codigo: string };

export async function chamarDaEscola<N extends FuncaoDaEscola>(nome: N, args: FuncoesDaEscola[N]["args"]): Promise<Chamada<FuncoesDaEscola[N]["volta"]>> {
  if (emPrevia()) {
    const lido = await lerDaEscola(nome, args);
    return lido.ok ? lido : { ok: false, codigo: lido.motivo };
  }
  try {
    const dados = await rpc<FuncoesDaEscola[N]["volta"]>(nome, args as Record<string, unknown>);
    return { ok: true, dados };
  } catch (erro) {
    return { ok: false, codigo: erro instanceof BackendError ? erro.code : "falha" };
  }
}
