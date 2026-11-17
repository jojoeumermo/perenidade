// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { createContext, useContext } from "react";
import { BackendError, getClient, hasBackend } from "@/lib/backend";

/**
 * As rotas do servidor do painel único (app/api/alumia/admin/*), com a sessão de quem está no painel. Só elas falam com a
 * Cloudflare e calculam o resumo do e-mail: o navegador nunca vê a chave da Cloudflare nem o e-mail de ninguém. Erro vira
 * BackendError com o código que a rota devolveu, para a janela mostrar o texto certo.
 */
export async function chamarRota<T>(caminho: "/api/alumia/admin/banir" | "/api/alumia/admin/borda", corpo: Record<string, unknown>): Promise<T> {
  if (!hasBackend) throw new BackendError("sem_servico");
  const token = (await (await getClient()).auth.getSession()).data.session?.access_token;
  if (!token) throw new BackendError("entre_primeiro");
  const r = await fetch(caminho, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });
  const dado = (await r.json().catch(() => null)) as (T & { ok?: boolean; codigo?: string }) | null;
  if (r.status === 404) throw new BackendError("sem_permissao");
  if (!r.ok || !dado || dado.ok === false) {
    const codigo = String(dado?.codigo ?? "sem_conexao");
    throw new BackendError(codigo);
  }
  return dado;
}

/** Dentro do painel único: as telas reaproveitadas do painel de controle mostram as ações que só a coordenação com o código tem. */
export const PainelUnicoCtx = createContext(false);
export const useNoPainelUnico = () => useContext(PainelUnicoCtx);

/** Os números de pessoas só a partir de 3 (o banco manda {n, algum}). */
export function numeroDePessoas(c: { n: number | null; algum: boolean } | undefined, uma: string, varias: string): string {
  if (!c || !c.algum) return `nenhuma ${uma}`;
  if (c.n === null) return `menos de 3 ${varias}`;
  return `${c.n} ${varias}`;
}
