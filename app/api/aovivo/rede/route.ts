// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aulas ao vivo: as credenciais do servidor de retransmissão (TURN da Cloudflare). Com elas o vídeo passa pelo servidor
// e ninguém na sala (nem quem conduz) vê o endereço de rede de quem assiste. Só para aula que existe e está marcada ou no
// ar, e por poucas horas. Sem as chaves (CLOUDFLARE_TURN_KEY_ID e CLOUDFLARE_TURN_TOKEN, na Vercel), responde vazio e a
// sala segue como antes (ligação direta entre os navegadores).
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const vazio = () => Response.json({ iceServers: null }, { headers: semGuardar });

export async function GET(pedido: Request) {
  const chave = process.env.CLOUDFLARE_TURN_KEY_ID ?? "";
  const token = process.env.CLOUDFLARE_TURN_TOKEN ?? "";
  if (!/^[a-f0-9]{32}$/i.test(chave) || !token) return vazio();
  const aula = new URL(pedido.url).searchParams.get("aula") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(aula)) return Response.json({ erro: "aula" }, { status: 400, headers: semGuardar });
  const dados = await rpcNoBanco<{ status?: string } | null>("aula_ao_vivo_ver", { p_id: aula });
  if (!dados.ok || !dados.dados || !["agendada", "ao_vivo"].includes(dados.dados.status ?? "")) return Response.json({ erro: "aula" }, { status: 404, headers: semGuardar });
  try {
    const resposta = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${chave}/credentials/generate-ice-servers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // Quatro horas: cobre a aula mais longa; depois a credencial não serve para nada.
      body: JSON.stringify({ ttl: 4 * 3600 }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    const corpo = (await resposta.json().catch(() => null)) as { iceServers?: { urls?: string | string[]; username?: string; credential?: string }[] } | null;
    if (!resposta.ok || !Array.isArray(corpo?.iceServers)) return vazio();
    // A porta 53 costuma ser barrada nos navegadores e só atrasa a ligação.
    const iceServers = corpo.iceServers.map((s) => ({ ...s, urls: [s.urls ?? []].flat().filter((u) => typeof u === "string" && !/:53(\?|$)/.test(u)) })).filter((s) => s.urls.length);
    return Response.json({ iceServers }, { headers: semGuardar });
  } catch {
    return vazio();
  }
}
