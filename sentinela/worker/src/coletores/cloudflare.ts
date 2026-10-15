// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Cloudflare: tráfego e eventos de segurança (WAF) pela API GraphQL de análise, e as ações de bloqueio pela API de
// regras de acesso. O token precisa só de Zone.Analytics:Read e Zone.Firewall Services:Edit, na zona do site.
import type { Evento, Gravidade } from "../tipos.ts";
import { ISCA, impressao, limpo, minutosAtras, pegarJson } from "../util.ts";

const GRAPHQL = "https://api.cloudflare.com/client/v4/graphql";
const API = "https://api.cloudflare.com/client/v4";

interface RespostaGraphQL {
  data?: { viewer?: { zones?: { trafego?: GrupoTrafego[]; eventos?: EventoFirewall[] }[] } };
  errors?: { message: string }[];
}
interface GrupoTrafego {
  count: number;
  sum: { edgeResponseBytes: number };
  dimensions: { datetimeFiveMinutes: string; clientCountryName: string; edgeResponseStatus: number };
}
export interface EventoFirewall {
  action: string;
  clientIP: string;
  clientCountryName: string;
  clientASNDescription: string;
  clientAsn: string;
  clientRequestPath: string;
  clientRequestHTTPMethodName?: string;
  userAgent: string;
  ruleId: string;
  source: string;
  datetime: string;
  rayName: string;
}

const consulta = (zona: string, desde: string, ate: string) => `{
  viewer { zones(filter: { zoneTag: "${zona}" }) {
    trafego: httpRequestsAdaptiveGroups(limit: 2000, filter: { datetime_geq: "${desde}", datetime_lt: "${ate}" }) {
      count sum { edgeResponseBytes } dimensions { datetimeFiveMinutes clientCountryName edgeResponseStatus }
    }
    eventos: firewallEventsAdaptive(limit: 2000, orderBy: [datetime_DESC], filter: { datetime_geq: "${desde}", datetime_lt: "${ate}" }) {
      action clientIP clientCountryName clientASNDescription clientAsn clientRequestPath clientRequestHTTPMethodName userAgent ruleId source datetime rayName
    }
  } }
}`;

export interface ColetaCloudflare {
  metricas: { em: string; requisicoes: number; bloqueios: number; desafios: number; bytes: number; por_pais: Record<string, number>; por_status: Record<string, number> }[];
  eventos: Evento[];
  erro?: string;
}

const BLOQUEIO = new Set(["block", "drop", "connection_close"]);
const DESAFIO = new Set(["managed_challenge", "challenge", "js_challenge", "jschallenge", "challenge_solved", "challenge_failed", "challenge_bypassed", "jschallenge_solved", "jschallenge_failed", "managed_challenge_non_interactive_solved", "managed_challenge_interactive_solved", "managed_challenge_skipped"]);

export function gravidadeDoWaf(e: EventoFirewall): Gravidade {
  if (ISCA.test(e.clientRequestPath ?? "")) return "media";
  if (BLOQUEIO.has(e.action)) return "media";
  if (e.action === "log" || DESAFIO.has(e.action)) return "baixa";
  return "info";
}

/** Transforma a resposta da Cloudflare em métricas por janela de cinco minutos e em eventos. */
export async function montar(grupos: GrupoTrafego[], brutos: EventoFirewall[]): Promise<ColetaCloudflare> {
  const janelas = new Map<string, ColetaCloudflare["metricas"][number]>();
  const janela = (em: string) => {
    const chave = em.slice(0, 16).replace(/(\d)\d$/, (_, d: string) => `${Math.floor(Number(d + "0") / 5) * 5}`.padStart(2, "0")) + ":00Z";
    let m = janelas.get(chave);
    if (!m) {
      m = { em: chave, requisicoes: 0, bloqueios: 0, desafios: 0, bytes: 0, por_pais: {}, por_status: {} };
      janelas.set(chave, m);
    }
    return m;
  };
  for (const g of grupos) {
    const m = janela(g.dimensions.datetimeFiveMinutes);
    m.requisicoes += g.count;
    m.bytes += g.sum?.edgeResponseBytes ?? 0;
    const pais = g.dimensions.clientCountryName || "?";
    m.por_pais[pais] = (m.por_pais[pais] ?? 0) + g.count;
    const status = String(g.dimensions.edgeResponseStatus);
    m.por_status[status] = (m.por_status[status] ?? 0) + g.count;
  }
  const eventos: Evento[] = [];
  for (const e of brutos) {
    const m = janela(e.datetime);
    if (BLOQUEIO.has(e.action)) m.bloqueios++;
    else if (DESAFIO.has(e.action)) m.desafios++;
    const isca = ISCA.test(e.clientRequestPath ?? "");
    eventos.push({
      em: e.datetime,
      fonte: isca ? "isca" : "waf",
      tipo: isca ? "isca" : e.source || "waf",
      gravidade: gravidadeDoWaf(e),
      ip: limpo(e.clientIP, 45),
      pais: limpo(e.clientCountryName, 2),
      asn: e.clientAsn ? `AS${e.clientAsn}` : "",
      asn_nome: limpo(e.clientASNDescription, 120),
      caminho: limpo(e.clientRequestPath, 300),
      agente: limpo(e.userAgent, 300),
      acao: limpo(e.action, 40),
      regra: limpo(e.ruleId, 120),
      detalhes: { metodo: e.clientRequestHTTPMethodName ?? "" },
      impressao: e.rayName ? `cf:${e.rayName}` : await impressao("cf", e.datetime, e.clientIP, e.clientRequestPath, e.action),
    });
  }
  // Os top 20 países e códigos bastam para o gráfico.
  for (const m of janelas.values()) {
    m.por_pais = Object.fromEntries(Object.entries(m.por_pais).sort((a, b) => b[1] - a[1]).slice(0, 20));
    m.por_status = Object.fromEntries(Object.entries(m.por_status).sort((a, b) => b[1] - a[1]).slice(0, 20));
  }
  return { metricas: [...janelas.values()].sort((a, b) => a.em.localeCompare(b.em)), eventos };
}

export async function coletarCloudflare(token: string, zona: string, desdeMinutos = 15): Promise<ColetaCloudflare> {
  if (!token || !zona) return { metricas: [], eventos: [], erro: "sem token ou zona" };
  const ate = new Date(Math.floor(Date.now() / 300_000) * 300_000).toISOString();
  const resposta = await pegarJson<RespostaGraphQL>(GRAPHQL, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: consulta(zona, minutosAtras(desdeMinutos), ate) }) }, 20_000);
  if (!resposta) return { metricas: [], eventos: [], erro: "a Cloudflare não respondeu" };
  if (resposta.errors?.length) return { metricas: [], eventos: [], erro: limpo(resposta.errors[0].message, 200) };
  const zonaDados = resposta.data?.viewer?.zones?.[0];
  return montar(zonaDados?.trafego ?? [], zonaDados?.eventos ?? []);
}

// ───────────────────────────── Ações ─────────────────────────────

interface RespostaApi {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { id?: string };
}

/** Cria uma regra de acesso na zona (bloqueio ou desafio) e devolve o identificador, para desfazer depois. */
export async function aplicarAcao(token: string, zona: string, tipo: string, alvo: string, motivo: string): Promise<{ ok: boolean; referencia?: string; erro?: string }> {
  if (!token || !zona) return { ok: false, erro: "sem token ou zona" };
  const alvoApi = tipo === "bloquear_asn" ? "asn" : tipo === "bloquear_pais" ? "country" : alvo.includes("/") ? "ip_range" : "ip";
  const modo = tipo === "desafiar_ip" ? "managed_challenge" : "block";
  const resposta = await pegarJson<RespostaApi>(`${API}/zones/${zona}/firewall/access_rules/rules`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ mode: modo, configuration: { target: alvoApi, value: alvo }, notes: `Sentinela Lúcia: ${motivo}`.slice(0, 200) }),
  }, 20_000);
  if (!resposta) return { ok: false, erro: "a Cloudflare não respondeu" };
  if (!resposta.success || !resposta.result?.id) return { ok: false, erro: limpo(resposta.errors?.[0]?.message ?? "recusado", 200) };
  return { ok: true, referencia: resposta.result.id };
}

export async function desfazerAcao(token: string, zona: string, referencia: string): Promise<{ ok: boolean; erro?: string }> {
  if (!token || !zona || !/^[a-f0-9]{32}$/.test(referencia)) return { ok: false, erro: "referência inválida" };
  const resposta = await pegarJson<RespostaApi>(`${API}/zones/${zona}/firewall/access_rules/rules/${referencia}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }, 20_000);
  if (!resposta) return { ok: false, erro: "a Cloudflare não respondeu" };
  // Regra que já não existe conta como desfeita.
  if (!resposta.success && !resposta.errors?.some((e) => e.code === 10001 || /not found/i.test(e.message))) return { ok: false, erro: limpo(resposta.errors?.[0]?.message ?? "recusado", 200) };
  return { ok: true };
}
