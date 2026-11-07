// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aulas ao vivo: as credenciais do servidor de retransmissão (TURN da Cloudflare). Com elas o vídeo passa pelo servidor
// e ninguém na sala (nem quem conduz) vê o endereço de rede de quem assiste. Só para aula que existe e está marcada ou no
// ar (ou para a sala do podcast ao vivo que está no ar), e por poucas horas. Sem as chaves (CLOUDFLARE_TURN_KEY_ID, CLOUDFLARE_TURN_TOKEN, CLOUDFLARE_ACCOUNT_ID e
// CLOUDFLARE_ANALYTICS_TOKEN, na Vercel), ou passado o teto de gasto (abaixo), responde vazio e a
// sala segue como antes (ligação direta entre os navegadores).
//
// T33 (auditoria de 07/11/2026): a credencial é cara (cada uma vale horas de retransmissão paga além da cota) e a sala do
// podcast é pública. Por isso: limite por pessoa (resumo do IP com sal do dia, só na memória, o mesmo de
// lib/assistente/limite.ts) e por faixa de rede; UMA credencial por sala a cada 5 minutos (pedir de novo devolve a mesma, não
// cria outra); e o teto do mês mais baixo (600 GB), com folga para o atraso da conta da Cloudflare e para as credenciais
// já entregues. A validade continua 4 horas: a retransmissão renova a reserva com a mesma credencial durante a aula, e
// uma credencial vencida derrubaria o vídeo no meio.
import { criarLimitador, ipDoPedido } from "@/lib/assistente/limite";
import { rpcNoBanco } from "@/lib/instagram";

export const dynamic = "force-dynamic";

/** Por pessoa: 20 credenciais por hora e 120 no dia (uma aula com quedas pede algumas); por faixa, 60 e 400. */
const limitador = criarLimitador({ porHora: 20, porDia: 120, globalDia: 50_000, faixaHora: 60, faixaDia: 400 });
/** A credencial de cada sala, guardada por 5 minutos: quem pede de novo recebe a mesma. */
const PORSALA_MS = 5 * 60_000;
const daSala = new Map<string, { ate: number; iceServers: unknown[] }>();

const semGuardar = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Teto de gasto: a cota grátis do TURN é de 1.000 GB por mês e o que passa disso é cobrado. Antes de entregar uma
 * credencial, o site pergunta à Cloudflare quanto já foi usado no mês (GraphQL, permissão "Account Analytics: Read") e,
 * de 600 GB para cima, para de entregar: as aulas voltam à ligação direta (o podcast, não: sem retransmissão ele não liga). Sem como
 * conferir (token ausente, consulta falhou), também não entrega. A conta é guardada por 10 minutos.
 */
const TETO_BYTES = 600 * 1024 ** 3;
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
  const busca = new URL(pedido.url).searchParams;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  // O IP vira resumo aqui e some (só na memória, sal do dia): nada é gravado.
  const vez = limitador.consumir(ipDoPedido(pedido.headers));
  if (!vez.ok) return Response.json({ erro: "muitos_pedidos" }, { status: 429, headers: { ...semGuardar, "Retry-After": String(vez.tentarEm) } });
  // Podcast ao vivo (T17; docs/PODCAST-AO-VIVO.md): a mesma retransmissão, só para a sala da transmissão que está no ar.
  const podcast = busca.get("podcast");
  if (podcast !== null) {
    if (!uuid.test(podcast)) return Response.json({ erro: "podcast" }, { status: 400, headers: semGuardar });
    const vivo = await rpcNoBanco<{ no_ar?: boolean; modo?: string; sala?: string } | null>("podcast_ao_vivo_estado", {});
    if (!vivo.ok || !vivo.dados?.no_ar || vivo.dados.modo !== "navegador" || vivo.dados.sala !== podcast) return Response.json({ erro: "podcast" }, { status: 404, headers: semGuardar });
  } else {
    const aula = busca.get("aula") ?? "";
    if (!uuid.test(aula)) return Response.json({ erro: "aula" }, { status: 400, headers: semGuardar });
    const dados = await rpcNoBanco<{ status?: string } | null>("aula_ao_vivo_ver", { p_id: aula });
    if (!dados.ok || !dados.dados || !["agendada", "ao_vivo"].includes(dados.dados.status ?? "")) return Response.json({ erro: "aula" }, { status: 404, headers: semGuardar });
  }
  if (!(await dentroDoTeto(chave))) return vazio();
  const sala = podcast !== null ? `podcast:${podcast}` : `aula:${busca.get("aula")}`;
  const guardada = daSala.get(sala);
  if (guardada && guardada.ate > Date.now()) return Response.json({ iceServers: guardada.iceServers }, { headers: semGuardar });
  if (daSala.size > 500) for (const [k, v] of daSala) if (v.ate <= Date.now()) daSala.delete(k);
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
    if (iceServers.length) daSala.set(sala, { ate: Date.now() + PORSALA_MS, iceServers });
    return Response.json({ iceServers }, { headers: semGuardar });
  } catch {
    return vazio();
  }
}
