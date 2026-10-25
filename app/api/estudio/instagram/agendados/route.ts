// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A tarefa automática das publicações agendadas: de 15 em 15 minutos, a rotina do GitHub (ou a da Vercel) chama esta
// rota com a chave CRON_SECRET; ela pega no banco o que já venceu (cada uma uma vez só), publica no Instagram e marca
// publicada ou com falha. Sem a chave certa, nada acontece.
import { timingSafeEqual } from "node:crypto";
import { agendaConfigurada, instagramConfigurado, publicarNoInstagram, rpcNoBanco, urlDePublicacao } from "@/lib/instagram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Compara a chave em tempo constante: a demora da resposta não entrega, letra por letra, quanto da chave acertou. */
function mesmaChave(veio: string, chave: string) {
  const a = Buffer.from(veio);
  const b = Buffer.from(chave);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Vencida {
  id: string;
  urls: string[];
  legenda: string;
}

async function rodar(pedido: Request) {
  const chave = process.env.CRON_SECRET ?? "";
  const veio = /^Bearer\s+(.+)$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? "";
  if (!agendaConfigurada() || !mesmaChave(veio, chave)) return Response.json({ erro: "sem_permissao" }, { status: 401 });
  if (!instagramConfigurado()) return Response.json({ erro: "instagram_nao_configurado" }, { status: 503 });
  const vencidas = await rpcNoBanco<Vencida[]>("design_publicacoes_vencidas", { p_chave: chave });
  if (!vencidas.ok) return Response.json({ erro: vencidas.erro }, { status: 502 });
  const feitas: { id: string; status: string }[] = [];
  for (const v of Array.isArray(vencidas.dados) ? vencidas.dados : []) {
    try {
      if (!Array.isArray(v.urls) || !v.urls.every(urlDePublicacao)) throw new Error("imagens_invalidas");
      const media = await publicarNoInstagram(v.urls, v.legenda);
      await rpcNoBanco("design_publicacao_marcar", { p_chave: chave, p_id: v.id, p_status: "publicada", p_media_id: media });
      feitas.push({ id: v.id, status: "publicada" });
    } catch (erro) {
      await rpcNoBanco("design_publicacao_marcar", { p_chave: chave, p_id: v.id, p_status: "falhou", p_erro: erro instanceof Error ? erro.message : "erro" });
      feitas.push({ id: v.id, status: "falhou" });
    }
  }
  return Response.json({ ok: true, feitas }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = rodar;
export const POST = rodar;
