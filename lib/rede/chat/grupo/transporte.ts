// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O transporte das caixas para o grupo com membros escondidos (a interface `Transporte` de lib/rede/membros/tipos.ts), montado sobre
// um cliente das caixas anônimas (no navegador, lib/rede/caixas/cliente.ts; nos testes, as funções do banco). Nada de cifra aqui.
//
// O que este adaptador acerta entre o grupo e as rotas:
//   - o cursor: depois do próprio commit, o grupo marca a caixa da época anterior como lida até o fim (Number.MAX_SAFE_INTEGER). A
//     rota e o banco guardam o cursor como integer do Postgres (até 2^31 - 1) e recusariam o pedido; um cursor nesse fim quer dizer
//     "nada mais a ler", então a resposta é a lista vazia, sem pedido nenhum;
//   - "cheia" (a caixa passou do teto de pacotes) chega ao grupo como "rede" (o grupo trata as duas igual: o depósito não saiu).
// Sem "@/": roda no Node nos testes.
import type { Caixa, Pacote, ResultadoDoDeposito, Transporte } from "../../membros/tipos";

/** O maior cursor que a rota e o banco aceitam (integer do Postgres). */
export const CURSOR_MAXIMO = 2 ** 31 - 1;

export interface ClienteDasCaixas {
  criar(c: Caixa): Promise<void>;
  depositar(c: Pick<Caixa, "id" | "pd">, envelope: Uint8Array, franquia?: Uint8Array, unico?: boolean): Promise<{ ok: true } | { ok: false; erro: string }>;
  buscar(c: Pick<Caixa, "id" | "pl">, cursor: number): Promise<Pacote[]>;
}

export function transporteDosGrupos(cliente: ClienteDasCaixas): Transporte {
  return {
    criar: (c) => cliente.criar(c),
    async depositar(c, envelope, franquia, unico): Promise<ResultadoDoDeposito> {
      const r = await cliente.depositar(c, envelope, franquia, unico);
      if (r.ok) return { ok: true };
      return { ok: false, erro: r.erro === "ocupada" || r.erro === "tamanho" ? r.erro : "rede" };
    },
    async buscar(c, cursor) {
      if (cursor >= CURSOR_MAXIMO) return [];
      return cliente.buscar(c, Math.max(0, Math.floor(cursor)));
    },
  };
}
