// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// Vercel (deploys), GitHub (alertas de segurança e rotinas falhando) e o Supabase do site (saúde e entradas erradas).
import type { Evento, Verificacao } from "../tipos.ts";
import { impressao, limpo, minutosAtras, pegar, pegarJson } from "../util.ts";

// ───────────────────────────── Vercel ─────────────────────────────

interface DeployVercel {
  uid: string;
  state?: string;
  readyState?: string;
  target?: string | null;
  url?: string;
  created?: number;
  ready?: number;
  meta?: Record<string, string>;
  creator?: { username?: string; email?: string };
}

export interface Deploy {
  id: string;
  estado: string;
  ambiente: string;
  url: string;
  ramo: string;
  commit: string;
  mensagem: string;
  autor: string;
  criado_em: string;
  pronto_em: string | null;
}

export function deployDe(d: DeployVercel): Deploy {
  return {
    id: d.uid,
    estado: (d.readyState ?? d.state ?? "").toUpperCase(),
    ambiente: d.target ?? "preview",
    url: d.url ? `https://${d.url}` : "",
    ramo: d.meta?.githubCommitRef ?? d.meta?.gitlabCommitRef ?? "",
    commit: (d.meta?.githubCommitSha ?? "").slice(0, 12),
    mensagem: limpo(d.meta?.githubCommitMessage ?? "", 300),
    autor: limpo(d.meta?.githubCommitAuthorLogin ?? d.creator?.username ?? "", 120),
    criado_em: new Date(d.created ?? Date.now()).toISOString(),
    pronto_em: d.ready ? new Date(d.ready).toISOString() : null,
  };
}

export async function coletarVercel(token: string, projeto: string, equipe = ""): Promise<Deploy[] | null> {
  if (!token || !projeto) return null;
  const url = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projeto)}&limit=20${equipe ? `&teamId=${encodeURIComponent(equipe)}` : ""}`;
  const dados = await pegarJson<{ deployments?: DeployVercel[] }>(url, { headers: { Authorization: `Bearer ${token}` } });
  return dados?.deployments?.map(deployDe) ?? null;
}

// ───────────────────────────── GitHub ─────────────────────────────

export interface AlertaGitHub {
  id: string;
  tipo: "dependabot" | "segredo" | "codigo" | "rotina";
  gravidade: string;
  titulo: string;
  pacote: string;
  estado: string;
  url: string;
  criado_em: string;
}

const cabecalhosGitHub = (token: string) => ({ Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "SentinelaLucia/1.0" });

export async function coletarGitHub(token: string, repositorio: string): Promise<AlertaGitHub[] | null> {
  if (!token || !/^[\w.-]+\/[\w.-]+$/.test(repositorio)) return null;
  const base = `https://api.github.com/repos/${repositorio}`;
  const h = cabecalhosGitHub(token);
  const [dependabot, segredos, codigo, rotinas] = await Promise.all([
    pegarJson<{ number: number; state: string; security_advisory?: { summary?: string; severity?: string }; dependency?: { package?: { name?: string } }; html_url?: string; created_at?: string }[]>(`${base}/dependabot/alerts?state=open&per_page=50`, { headers: h }),
    pegarJson<{ number: number; state: string; secret_type_display_name?: string; secret_type?: string; html_url?: string; created_at?: string }[]>(`${base}/secret-scanning/alerts?state=open&per_page=50`, { headers: h }),
    pegarJson<{ number: number; state: string; rule?: { description?: string; security_severity_level?: string; severity?: string }; html_url?: string; created_at?: string }[]>(`${base}/code-scanning/alerts?state=open&per_page=50`, { headers: h }),
    pegarJson<{ workflow_runs?: { id: number; name?: string; conclusion?: string; html_url?: string; created_at?: string; head_branch?: string }[] }>(`${base}/actions/runs?status=failure&per_page=10&created=>${minutosAtras(24 * 60).slice(0, 10)}`, { headers: h }),
  ]);
  if (!dependabot && !segredos && !codigo && !rotinas) return null;
  const lista: AlertaGitHub[] = [];
  for (const a of Array.isArray(dependabot) ? dependabot : []) lista.push({ id: `dependabot:${a.number}`, tipo: "dependabot", gravidade: a.security_advisory?.severity ?? "", titulo: limpo(a.security_advisory?.summary, 300), pacote: limpo(a.dependency?.package?.name, 120), estado: a.state, url: a.html_url ?? "", criado_em: a.created_at ?? new Date().toISOString() });
  for (const a of Array.isArray(segredos) ? segredos : []) lista.push({ id: `segredo:${a.number}`, tipo: "segredo", gravidade: "critical", titulo: limpo(a.secret_type_display_name ?? a.secret_type, 300), pacote: "", estado: a.state, url: a.html_url ?? "", criado_em: a.created_at ?? new Date().toISOString() });
  for (const a of Array.isArray(codigo) ? codigo : []) lista.push({ id: `codigo:${a.number}`, tipo: "codigo", gravidade: a.rule?.security_severity_level ?? a.rule?.severity ?? "", titulo: limpo(a.rule?.description, 300), pacote: "", estado: a.state, url: a.html_url ?? "", criado_em: a.created_at ?? new Date().toISOString() });
  for (const r of rotinas?.workflow_runs ?? []) lista.push({ id: `rotina:${r.id}`, tipo: "rotina", gravidade: "medium", titulo: limpo(`${r.name ?? "rotina"} falhou (${r.head_branch ?? ""})`, 300), pacote: "", estado: "open", url: r.html_url ?? "", criado_em: r.created_at ?? new Date().toISOString() });
  return lista;
}

// ───────────────────────────── Supabase do site ─────────────────────────────

/** Saúde do serviço de contas do site: a porta de entrada (auth) e a API (rest) respondem? */
export async function verificarSupabase(url: string, anon: string): Promise<Verificacao[]> {
  if (!url) return [];
  const base = url.replace(/\/$/, "");
  const alvos: [string, string, HeadersInit][] = [
    ["supabase", `${base}/auth/v1/health`, anon ? { apikey: anon } : {}],
    ["supabase:rest", `${base}/rest/v1/`, anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}],
    ["supabase:storage", `${base}/storage/v1/bucket`, anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : {}],
  ];
  return Promise.all(alvos.map(async ([alvo, endereco, headers]) => {
    const inicio = Date.now();
    const resposta = await pegar(endereco, { headers }, 10_000);
    const ms = Date.now() - inicio;
    // Sem a chave anônima, 401 ainda prova que o serviço está de pé.
    const noAr = Boolean(resposta && (resposta.ok || (!anon && (resposta.status === 401 || resposta.status === 400))));
    return { alvo, no_ar: noAr, status: resposta?.status, ms, erro: noAr ? "" : resposta ? `HTTP ${resposta.status}` : "sem resposta" };
  }));
}

interface LinhaDeLog {
  timestamp?: number | string;
  event_message?: string;
  metadata?: unknown;
}

/**
 * Entradas erradas no serviço de contas do site, pela Management API (opcional: exige um token pessoal). Lê os registros
 * do serviço de autenticação do último intervalo e conta as respostas de credencial inválida. Só o que o log já traz.
 */
export async function coletarLoginsFalhos(pat: string, ref: string, desdeMinutos = 15): Promise<Evento[] | null> {
  if (!pat || !/^[a-z]{20}$/.test(ref)) return null;
  const desde = minutosAtras(desdeMinutos);
  const sql = `select id, timestamp, event_message from auth_logs where timestamp > '${desde}' and (event_message like '%invalid_credentials%' or event_message like '%Invalid login credentials%' or event_message like '%invalid_grant%' or event_message like '%"status":400%' or event_message like '%"status":401%' or event_message like '%"status":429%') order by timestamp desc limit 500`;
  const dados = await pegarJson<{ result?: LinhaDeLog[]; error?: string }>(`https://api.supabase.com/v1/projects/${ref}/analytics/endpoints/logs.all?sql=${encodeURIComponent(sql)}`, { headers: { Authorization: `Bearer ${pat}` } }, 20_000);
  if (!dados || !Array.isArray(dados.result)) return null;
  const eventos: Evento[] = [];
  for (const linha of dados.result) {
    const texto = String(linha.event_message ?? "");
    let ip = "";
    let caminho = "";
    let msg = "";
    try {
      const j = JSON.parse(texto) as Record<string, unknown>;
      ip = String(j.remote_addr ?? j.x_forwarded_for ?? "").split(",")[0].trim();
      caminho = String(j.path ?? "");
      msg = String(j.msg ?? j.error ?? j.error_code ?? "");
    } catch {
      msg = texto.slice(0, 120);
    }
    const em = typeof linha.timestamp === "number" ? new Date(linha.timestamp / 1000).toISOString() : new Date(String(linha.timestamp ?? Date.now())).toISOString();
    eventos.push({ em, fonte: "auth", tipo: /429/.test(texto) ? "limite_atingido" : "login_falho", gravidade: "baixa", ip: limpo(ip, 45), caminho: limpo(caminho, 300), detalhes: { msg: limpo(msg, 200) }, impressao: await impressao("auth", em, ip, caminho, msg) });
  }
  return eventos;
}
