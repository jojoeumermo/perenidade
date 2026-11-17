// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rotina que apaga na Cloudflare os bloqueios da borda cujo prazo venceu (24 h a 7 dias). Chamada pelo pg_cron do banco
// (interno.alumia_admin_rotina, só quando há bloqueio vencido) ou por uma rotina do servidor, com a chave ALUMIA_BORDA_ROTINA (32
// letras ou mais). A chave é só desta rota, nunca a CRON_SECRET das outras rotinas: o banco guarda uma cópia dela para o pg_cron,
// e quem lê o banco só consegue pedir esta faxina. Sem a chave certa, nada acontece. Não devolve endereço nem regra: só quantos saíram.
import { timingSafeEqual } from "node:crypto";
import { configDaCloudflare } from "@/lib/rede/admin/cloudflare";
import { varrerVencidas } from "@/lib/rede/admin/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function mesmaChave(veio: string, chave: string) {
  const a = Buffer.from(veio);
  const b = Buffer.from(chave);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function rodar(pedido: Request) {
  const chave = process.env.ALUMIA_BORDA_ROTINA ?? "";
  const veio = /^Bearer\s+(.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  if (chave.length < 32 || !mesmaChave(veio, chave)) return Response.json({ erro: "sem_permissao" }, { status: 401 });
  const cfg = configDaCloudflare();
  if (!cfg) return Response.json({ erro: "sem_configuracao" }, { status: 503 });
  const saidos = await varrerVencidas(cfg);
  return Response.json({ ok: true, saidos }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = rodar;
export const POST = rodar;
