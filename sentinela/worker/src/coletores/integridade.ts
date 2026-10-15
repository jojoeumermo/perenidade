// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// DNS (pela resolução pública da Cloudflare, em HTTPS), certificados emitidos para o domínio (CT logs, via crt.sh),
// domínios parecidos que passaram a existir e reputação das origens já vistas nos logs.
import { pegarJson } from "../util.ts";

// ───────────────────────────── DNS ─────────────────────────────

interface RespostaDoH {
  Status: number;
  Answer?: { name: string; type: number; data: string }[];
}
const TIPOS: Record<string, number> = { A: 1, AAAA: 28, NS: 2, CNAME: 5, MX: 15, TXT: 16, CAA: 257 };

export async function resolver(nome: string, tipo: keyof typeof TIPOS): Promise<string[] | null> {
  const dados = await pegarJson<RespostaDoH>(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nome)}&type=${tipo}`, { headers: { Accept: "application/dns-json" } }, 8_000);
  if (!dados) return null;
  return (dados.Answer ?? []).filter((r) => r.type === TIPOS[tipo]).map((r) => r.data.replace(/^"|"$/g, "").trim()).sort();
}

export interface RegistroDns {
  nome: string;
  tipo: string;
  valores: string[];
}

/** Os registros que importam para o site, o e-mail e a emissão de certificados. */
export async function coletarDns(dominio: string): Promise<RegistroDns[]> {
  const pedidos: [string, keyof typeof TIPOS][] = [
    [dominio, "A"], [dominio, "AAAA"], [dominio, "NS"], [dominio, "MX"], [dominio, "TXT"], [dominio, "CAA"],
    [`www.${dominio}`, "A"], [`www.${dominio}`, "CNAME"], [`_dmarc.${dominio}`, "TXT"],
  ];
  const registros: RegistroDns[] = [];
  for (const [nome, tipo] of pedidos) {
    const valores = await resolver(nome, tipo);
    // Sem resposta (serviço fora) não é "sumiu": só grava quando a resolução respondeu.
    if (valores !== null) registros.push({ nome, tipo, valores });
  }
  return registros;
}

/** Faltas de postura no DNS: CAA e DMARC protegem contra certificado indevido e e-mail falso em nome do domínio. */
export function faltasDoDns(registros: RegistroDns[]): string[] {
  const faltas: string[] = [];
  const caa = registros.find((r) => r.tipo === "CAA" && !r.nome.startsWith("_"));
  if (!caa || caa.valores.length === 0) faltas.push("sem registro CAA (qualquer autoridade pode emitir certificado para o domínio)");
  const dmarc = registros.find((r) => r.nome.startsWith("_dmarc."));
  if (!dmarc || !dmarc.valores.some((v) => /^v=DMARC1/i.test(v))) faltas.push("sem DMARC (e-mail falso em nome do domínio não é barrado)");
  else if (dmarc.valores.some((v) => /p=none/i.test(v))) faltas.push("DMARC em p=none (só observa; não barra)");
  const spf = registros.find((r) => r.tipo === "TXT" && !r.nome.startsWith("_"))?.valores.find((v) => /^v=spf1/i.test(v));
  if (!spf) faltas.push("sem SPF");
  else if (!/-all/.test(spf)) faltas.push("SPF sem -all (falha branda)");
  return faltas;
}

// ───────────────────────────── Certificados (CT logs) ─────────────────────────────

interface EntradaCrtSh {
  id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  not_before: string;
  not_after: string;
}
export interface Certificado {
  crt_id: number;
  emissor: string;
  nome_comum: string;
  nomes: string[];
  nao_antes: string;
  nao_depois: string;
  conhecido: boolean;
}

/** Só o nome da organização emissora ("O=Let's Encrypt"), para comparar com a lista de emissores conhecidos. */
export const emissorDe = (issuer: string) => /O=([^,]+)/.exec(issuer)?.[1]?.replace(/^"|"$/g, "").trim() ?? issuer.slice(0, 120);

export async function coletarCertificados(dominio: string, emissoresConhecidos: string[]): Promise<Certificado[] | null> {
  const dados = await pegarJson<EntradaCrtSh[]>(`https://crt.sh/?q=${encodeURIComponent(`%.${dominio}`)}&output=json&exclude=expired`, { headers: { "User-Agent": "SentinelaLucia/1.0" } }, 25_000);
  const apex = await pegarJson<EntradaCrtSh[]>(`https://crt.sh/?q=${encodeURIComponent(dominio)}&output=json&exclude=expired`, { headers: { "User-Agent": "SentinelaLucia/1.0" } }, 25_000);
  if (!Array.isArray(dados) && !Array.isArray(apex)) return null;
  const vistos = new Map<number, Certificado>();
  for (const e of [...(Array.isArray(dados) ? dados : []), ...(Array.isArray(apex) ? apex : [])]) {
    if (vistos.has(e.id)) continue;
    const emissor = emissorDe(e.issuer_name ?? "");
    vistos.set(e.id, {
      crt_id: e.id,
      emissor,
      nome_comum: (e.common_name ?? "").slice(0, 200),
      nomes: [...new Set((e.name_value ?? "").split("\n").map((n) => n.trim()).filter(Boolean))].slice(0, 50),
      nao_antes: e.not_before,
      nao_depois: e.not_after,
      conhecido: emissoresConhecidos.some((c) => emissor.toLowerCase().includes(c.toLowerCase())),
    });
  }
  return [...vistos.values()].sort((a, b) => b.crt_id - a.crt_id).slice(0, 200);
}

// ───────────────────────────── Domínios parecidos ─────────────────────────────

const TLDS = ["com", "net", "org.br", "com.br", "co", "info", "site", "online", "app", "net.br", "edu.br", "xyz"];
const TROCAS: Record<string, string[]> = { l: ["1", "i"], i: ["l", "1"], o: ["0"], u: ["v"], a: ["4"], e: ["3"], s: ["5"], c: ["k"], t: ["7"] };

/** Variações do domínio que um golpista registraria: outras terminações, hífen, letra trocada, letra a menos, letras invertidas. */
export function parecidos(dominio: string): string[] {
  const [nome, ...resto] = dominio.toLowerCase().split(".");
  const tld = resto.join(".");
  const lista = new Set<string>();
  for (const t of TLDS) if (t !== tld) lista.add(`${nome}.${t}`);
  for (let i = 1; i < nome.length - 1; i++) {
    if (/[a-z]/.test(nome[i - 1]) && /[a-z]/.test(nome[i])) lista.add(`${nome.slice(0, i)}-${nome.slice(i)}.${tld}`);
  }
  for (let i = 0; i < nome.length; i++) {
    for (const troca of TROCAS[nome[i]] ?? []) lista.add(`${nome.slice(0, i)}${troca}${nome.slice(i + 1)}.${tld}`);
    if (nome.length > 6) lista.add(`${nome.slice(0, i)}${nome.slice(i + 1)}.${tld}`);
    if (i < nome.length - 1 && nome[i] !== nome[i + 1]) lista.add(`${nome.slice(0, i)}${nome[i + 1]}${nome[i]}${nome.slice(i + 2)}.${tld}`);
    if (nome[i] === nome[i + 1]) continue;
    lista.add(`${nome.slice(0, i + 1)}${nome[i]}${nome.slice(i + 1)}.${tld}`);
  }
  lista.delete(dominio.toLowerCase());
  // Só os que têm hífen no meio do nome e nenhum caractere estranho.
  return [...lista].filter((d) => /^[a-z0-9-]+(\.[a-z]+)+$/.test(d) && !/^-|-\./.test(d)).slice(0, 120);
}

export interface DominioParecido {
  dominio: string;
  resolve: boolean;
  registros: { A?: string[]; NS?: string[]; MX?: string[] };
}

export async function coletarDominios(dominio: string, limite = 60): Promise<DominioParecido[]> {
  // Roda em rodízio: a cada passada confere uma fatia, sorteada pela hora, para não disparar dezenas de consultas de uma vez.
  const todos = parecidos(dominio);
  const inicio = (Math.floor(Date.now() / 21_600_000) * limite) % Math.max(todos.length, 1);
  const fatia = [...todos.slice(inicio, inicio + limite), ...todos.slice(0, Math.max(0, inicio + limite - todos.length))];
  const resultados: DominioParecido[] = [];
  for (const d of fatia) {
    const a = await resolver(d, "A");
    if (a === null) continue;
    const registros: DominioParecido["registros"] = { A: a };
    if (a.length) {
      registros.NS = (await resolver(d, "NS")) ?? [];
      registros.MX = (await resolver(d, "MX")) ?? [];
    }
    resultados.push({ dominio: d, resolve: a.length > 0, registros });
  }
  return resultados;
}

// ───────────────────────────── Reputação de IP (opcional) ─────────────────────────────

interface RespostaAbuse {
  data?: { ipAddress: string; abuseConfidenceScore: number; countryCode?: string; usageType?: string; isp?: string; totalReports?: number; lastReportedAt?: string };
}

/** Reputação pública de um endereço que JÁ apareceu bloqueado nos logs. Nunca de visitantes comuns. */
export async function reputacao(chave: string, ip: string): Promise<{ abuso: number; relatos: number; uso: string; isp: string } | null> {
  if (!chave || !ip) return null;
  const dados = await pegarJson<RespostaAbuse>(`https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`, { headers: { Key: chave, Accept: "application/json" } }, 10_000);
  if (!dados?.data) return null;
  return { abuso: dados.data.abuseConfidenceScore ?? 0, relatos: dados.data.totalReports ?? 0, uso: (dados.data.usageType ?? "").slice(0, 60), isp: (dados.data.isp ?? "").slice(0, 120) };
}
