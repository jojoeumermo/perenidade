// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aulas ao vivo: as credenciais do servidor de retransmissão (TURN da Cloudflare). Com elas o vídeo passa pelo servidor
// e ninguém na sala (nem quem conduz) vê o endereço de rede de quem assiste. Só para aula que existe e está marcada ou no
// ar, e por poucas horas. Sem as chaves (CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_TOKEN, CLOUDFLARE_ACCOUNT_ID e
// CLOUDFLARE_ANALYTICS_TOKEN, na Vercel), ou passado o teto de gasto (abaixo), responde vazio e a
// sala segue como antes (ligação direta entre os navegadores).
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Teto de gasto: a cota grátis do TURN é de 1.000 GB por mês e o que passa disso é cobrado. Antes de entregar uma
 * credencial, o site pergunta à Cloudflare quanto já foi usado no mês (GraphQL, permissão "Account Analytics: Read") e,
 * de 800 GB para cima, para de entregar: as aulas voltam à ligação direta, que não passa pela Cloudflare. Sem como
 * conferir (token ausente, consulta falhou), também não entrega. A conta é guardada por 10 minutos.
 */
const TETO_BYTES = 800 * 1024 ** 3;
let conferido: { ate: number; dentro: boolean } | null = null;

async function dentroDoTeto(chave: string): Promise<boolean> {
  if (conferido && conferido.ate > Date.now()) return conferido.dentro;
  const token = process.env.CLOUDFLARE_ANALYTICS_TOKEN ?? "";
  const conta = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
  let dentro = false;
  if (token && /^[a-f0-9]{32}$/i.test(conta)) {
    const hoje = new Date();
    const inicio = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const fim = hoje.toISOString().slice(0, 10);
    const query = `query { viewer { accounts(filter: { accountTag: "${conta}" }) { callsTurnUsageAdaptiveGroups(limit: 1, filter: { date_geq: "${inicio}", date_leq: "${fim}", keyId: "${chave}" }) { sum { egressBytes ingressBytes } } } } }`;
    try {
      const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      const corpo = (await r.json().catch(() => null)) as { data?: { viewer?: { accounts?: { callsTurnUsageAdaptiveGroups?: { sum?: { egressBytes?: number; ingressBytes?: number } }[] }[] } }; errors?: unknown[] } | null;
      const contas = corpo?.data?.viewer?.accounts;
      if (r.ok && !corpo?.errors?.length && Array.isArray(contas) && contas.length === 1) {
        const usado = (contas[0].callsTurnUsageAdaptiveGroups ?? []).reduce((t, g) => t + (g.sum?.egressBytes ?? 0) + (g.sum?.ingressBytes ?? 0), 0);
        dentro = usado < TETO_BYTES;
      }
    } catch {
      dentro = false;
    }
  }
  conferido = { ate: Date.now() + 10 * 60_000, dentro };
  return dentro;
}
const vazio = () => Response.json({ iceServers: null }, { headers: semGuardar });

export async function GET(pedido: Request) {
  const chave = process.env.CLOUDFLARE_TURN_KEY_ID ?? "";
  const token = process.env.CLOUDFLARE_TURN_TOKEN ?? "";
  if (!/^[a-f0-9]{32}$/i.test(chave) || !token) return vazio();
  const aula = new URL(pedido.url).searchParams.get("aula") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(aula)) return Response.json({ erro: "aula" }, { status: 400, headers: semGuardar });
  const dados = await rpcNoBanco<{ status?: string } | null>("aula_ao_vivo_ver", { p_id: aula });
  if (!dados.ok || !dados.dados || !["agendada", "ao_vivo"].includes(dados.dados.status ?? "")) return Response.json({ erro: "aula" }, { status: 404, headers: semGuardar });
  if (!(await dentroDoTeto(chave))) return vazio();
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
