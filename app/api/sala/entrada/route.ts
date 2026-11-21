// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A entrada numa sala de vídeo do painel pelo LiveKit (Prompt 4, item 141, atrás de "sala-livekit"; desligado, esta rota não existe).
//   POST { origem: "reuniao" | "estudo" | "turma-mes" | "turma-curso", sala, mes?, curso?, desafio? }, com a sessão no Authorization
//   (menos o estudo em grupo, que abre sem conta) → { url, token, papel, video, expira }.
// Quem pode entrar: as regras de hoje, conferidas no banco com a sessão de quem pede (lib/sala/entrada.ts). O token (lib/sala/
// livekit.ts) vale 2 horas, para aquela sala, com identidade sorteada e sem nome nem e-mail. A chave e o segredo do projeto
// (LIVEKIT_API_KEY e LIVEKIT_API_SECRET) ficam só no servidor. Nada é gravado: o endereço de rede só vira, na hora, o resumo do
// limite de pedidos do estudo em grupo (lib/assistente/limite.ts, só na memória, com sal do dia).
import { criarLimitador, ipDoPedido } from "@/lib/assistente/limite";
import { recursoLigado } from "@/lib/recursos-vivos";
import { conferirDesafioDaCloudflare } from "@/lib/rede/convites/turnstile";
import { decidirEntrada, lerPedido } from "@/lib/sala/entrada";
import { configDoLivekit, tokenDaSala } from "@/lib/sala/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const semGuardar = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const responder = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semGuardar });

// O estudo em grupo: 30 entradas por hora e 120 por dia por pessoa (pelo resumo do endereço), 5000 no site por dia.
const limitador = criarLimitador({ porHora: 30, porDia: 120, globalDia: 5000 });

async function rpcComo(sessao: string, funcao: string, args: Record<string, unknown>): Promise<unknown> {
  if (!SUPA || !ANON) return null;
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: ANON, Authorization: `Bearer ${sessao}`, "Content-Type": "application/json" },
      body: JSON.stringify(args),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return r.ok ? await r.json().catch(() => null) : null;
  } catch {
    return null;
  }
}

export async function POST(pedido: Request) {
  if (!(await recursoLigado("sala-livekit"))) return new Response(null, { status: 404, headers: semGuardar });
  const config = configDoLivekit(process.env);
  if (!config) return responder({ erro: "livekit_sem_config" }, 503);
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return responder({ erro: "sem_permissao" }, 403);
  if (Number(pedido.headers.get("content-length") ?? 0) > 4096) return responder({ erro: "pedido" }, 413);
  const lido = lerPedido(await pedido.json().catch(() => null));
  if (!lido) return responder({ erro: "pedido" }, 400);
  const sessao = /^Bearer ([A-Za-z0-9._-]{20,4096})$/.exec(pedido.headers.get("authorization") ?? "")?.[1] ?? null;

  const decisao = await decidirEntrada(lido, sessao, {
    rpcComo,
    conferirDesafio: conferirDesafioDaCloudflare,
    // O endereço vira resumo aqui dentro e some.
    limitar: () => {
      const vez = limitador.consumir(ipDoPedido(pedido.headers));
      return vez.ok ? { ok: true } : { ok: false, tentarEm: vez.tentarEm };
    },
  });
  if (!decisao.ok) return responder({ erro: decisao.erro }, decisao.status);
  const { token, expira } = tokenDaSala(config, lido.sala, decisao.papel);
  return responder({ url: config.url, token, papel: decisao.papel, video: decisao.video, expira });
}
