// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Publicar junto no Telegram (frente 13E, atrás de "alumia-telegram"), pela porta de fora: uma rotina chama esta rota com a chave
// CRON_SECRET (como /api/rede/agendados) e ela pega no banco os posts que saem agora (rede_pontes_telegram_pendentes, com a chave
// de serviço: só post de organização com selo, para a internet, publicado há mais de 10 minutos e ainda de pé), manda cada um ao
// canal da organização pelo robô do Telegram (ALUMIA_TELEGRAM_TOKEN, segredo do servidor) e devolve ao banco só se deu certo.
// Cada post sai uma vez. Não devolve texto, canal nem id de ninguém: só quantos saíram e quantos falharam.
import { timingSafeEqual } from "node:crypto";
import { configDoAmbiente } from "@/lib/rede/contas-extra";
import { telegramLigado } from "@/lib/rede/pontes/ligado";
import { chamarComoServico } from "@/lib/rede/pontes/robos";
import { enviarAoCanal, mensagemDoPost, tokenDoAmbiente, type PostParaOTelegram } from "@/lib/rede/pontes/telegram";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function mesmaChave(veio: string, chave: string) {
  const a = Buffer.from(veio);
  const b = Buffer.from(chave);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function rodar(pedido: Request) {
  const chave = process.env.CRON_SECRET ?? "";
  const veio = /^Bearer\s+(.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!chave || !mesmaChave(veio, chave)) return Response.json({ erro: "sem_permissao" }, { status: 401 });
  const token = tokenDoAmbiente();
  if (!telegramLigado() || !token) return Response.json({ ok: true, saidos: 0, falhas: 0, desligado: true }, { headers: { "Cache-Control": "no-store" } });
  const cfg = configDoAmbiente();
  if (!cfg) return Response.json({ erro: "banco_nao_configurado" }, { status: 503 });
  const lista = await chamarComoServico<PostParaOTelegram[]>(cfg, "rede_pontes_telegram_pendentes", { p_limite: 20 });
  if (!lista.ok) return Response.json({ erro: "banco" }, { status: 502 });
  let saidos = 0;
  let falhas = 0;
  for (const p of Array.isArray(lista.dado) ? lista.dado : []) {
    const ok = await enviarAoCanal(token, p.canal, mensagemDoPost(p, site.url));
    if (ok) saidos++;
    else falhas++;
    await chamarComoServico(cfg, "rede_pontes_telegram_resultado", { p_post: p.post, p_ok: ok });
  }
  return Response.json({ ok: true, saidos, falhas }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = rodar;
export const POST = rodar;
