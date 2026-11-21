// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A urna anônima (onda R3): POST {tipo, alvo, cedula} com Authorization: PrivateToken (o passe da urna DESTA votação). SEM sessão de
// conta: pedido com cookie de sessão ou com outro Authorization é recusado. O passe é conferido só com a chave pública da urna da
// votação (lib/rede/passes/servidor.ts) e gasto no banco junto com a cédula (public.rede_urna_depositar_anonimo, com o serviço). O
// servidor não sabe de quem é a cédula, e o banco não a liga a ninguém. Sem log do corpo nem do endereço. A lógica está em
// lib/rede/voto/urna-anonima.ts (testada no Node). Sem a chave de serviço ou sem a chave dos passes, responde 503 { erro: "sem_servico" }
// (tratarDeposito), como as rotas das caixas.
import { paraBytea } from "@/lib/rede/caixas/base";
import { lerCorpo, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { rpcDeServico } from "@/lib/rede/convites/servidor";
import { contextoDaUrna } from "@/lib/rede/passes/comum";
import { conferirPasse } from "@/lib/rede/passes/servidor";
import { tratarDeposito } from "@/lib/rede/voto/urna-anonima";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = tratarDeposito({
  trazSessao,
  lerCorpo,
  responder,
  contextoDaUrna,
  conferirPasse,
  paraBytea,
  depositar: async (args) => {
    const r = await rpcDeServico<unknown>("rede_urna_depositar_anonimo", args);
    return r.ok ? { ok: true } : { ok: false, status: r.status, codigo: r.codigo };
  },
});
