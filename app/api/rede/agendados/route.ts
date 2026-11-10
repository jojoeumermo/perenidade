// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O agendador da Alumia, pela porta de fora: quando o banco não tem o pg_cron (a migração 20261110-alumia-b1-casca.sql liga o
// pg_cron quando o serviço deixa), uma rotina chama esta rota com a chave CRON_SECRET e ela roda rede_pub_agendados_rodar com a
// chave de serviço. Cada agendado sai uma vez só (o banco trava a linha com "for update skip locked"), então rodar as duas
// coisas juntas não publica em dobro. Sem a chave certa, nada acontece. Não devolve texto, autor nem id de ninguém: só quantos
// saíram (LGPD art. 6º, III).
import { timingSafeEqual } from "node:crypto";
import { configDoAmbiente } from "@/lib/rede/contas-extra";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function mesmaChave(veio: string, chave: string) {
  const a = Buffer.from(veio);
  const b = Buffer.from(chave);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function rodar(pedido: Request) {
  const chave = process.env.CRON_SECRET ?? "";
  const veio = /^Bearer\s+(.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!chave || !mesmaChave(veio, chave)) return Response.json({ erro: "sem_permissao" }, { status: 401 });
  const cfg = configDoAmbiente();
  if (!cfg) return Response.json({ erro: "banco_nao_configurado" }, { status: 503 });
  try {
    const r = await fetch(`${cfg.url}/rest/v1/rpc/rede_pub_agendados_rodar`, {
      method: "POST",
      headers: { apikey: cfg.chave, Authorization: `Bearer ${cfg.chave}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return Response.json({ erro: `banco_${r.status}` }, { status: 502 });
    const saidos = Number(await r.json().catch(() => 0)) || 0;
    return Response.json({ ok: true, saidos }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ erro: "banco_fora_do_ar" }, { status: 502 });
  }
}

export const GET = rodar;
export const POST = rodar;
