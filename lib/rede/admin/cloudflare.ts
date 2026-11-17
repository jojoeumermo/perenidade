// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O bloqueio na borda durante um ataque (painel único da Alumia, aba Ataque): o servidor do site pede à Cloudflare uma regra de
// acesso por IP da zona (modo "block") e, quando o prazo vence, apaga a regra. O endereço é digitado pela coordenação na hora,
// vai do servidor direto à Cloudflare e não fica em lugar nenhum da Alumia: nem no banco (que guarda só o número da regra e a
// hora de vencer), nem em log, nem na resposta ao navegador.
//
// A chave fica só no servidor: ALUMIA_CF_TOKEN (um token com a permissão "Zona › Firewall Services › Editar", só nesta zona) e
// ALUMIA_CF_ZONA (o identificador da zona). Sem as duas, o painel diz que falta configurar e nada é chamado.
//
// Sem os atalhos "@/" de propósito: scripts/testar-alumia-admin.mjs roda este arquivo direto no Node.

export const API_DA_CLOUDFLARE = "https://api.cloudflare.com/client/v4";

export interface ConfigDaCloudflare {
  token: string;
  zona: string;
}

/** A configuração lida do ambiente, ou nula quando falta (a tela diz "falta configurar"). */
export function configDaCloudflare(ambiente: Record<string, string | undefined> = process.env): ConfigDaCloudflare | null {
  const token = (ambiente.ALUMIA_CF_TOKEN ?? "").trim();
  const zona = (ambiente.ALUMIA_CF_ZONA ?? "").trim().toLowerCase();
  if (token.length < 20 || !/^[0-9a-f]{32}$/.test(zona)) return null;
  return { token, zona };
}

export type AlvoDoBloqueio = { target: "ip" | "ip6" | "ip_range"; value: string };

function ipv4(texto: string): number[] | null {
  const partes = texto.split(".");
  if (partes.length !== 4) return null;
  const n = partes.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return n.every((x) => x >= 0 && x <= 255) ? n : null;
}

function grupos6(texto: string): number[] | null {
  if (!/^[0-9a-f:]+$/.test(texto) || texto.includes(":::")) return null;
  const lados = texto.split("::");
  if (lados.length > 2) return null;
  const esq = lados[0] ? lados[0].split(":") : [];
  const dir = lados.length === 2 && lados[1] ? lados[1].split(":") : [];
  const faltam = 8 - esq.length - dir.length;
  if (lados.length === 1 ? faltam !== 0 : faltam < 1) return null;
  const g = [...esq, ...Array<string>(lados.length === 2 ? faltam : 0).fill("0"), ...dir];
  if (g.length !== 8 || g.some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  return g.map((x) => parseInt(x, 16));
}

/** Endereços que nunca se bloqueiam: os da própria máquina, das redes internas e os reservados. Bloquear um deles só atrapalharia. */
function reservado4(n: number[]): boolean {
  const [a, b] = n;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
function reservado6(g: number[]): boolean {
  return g.every((x) => x === 0) || (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) || (g[0] & 0xfe00) === 0xfc00 || (g[0] & 0xffc0) === 0xfe80 || (g[0] & 0xff00) === 0xff00;
}

/**
 * O que a coordenação digitou, na forma que a Cloudflare aceita: um IPv4, um IPv6, ou uma faixa (IPv4 /16 ou /24; IPv6 /32, /48
 * ou /64, as que a regra de acesso da zona aceita). Devolve o motivo quando não serve. O texto não é guardado em lugar nenhum.
 */
export function alvoDoBloqueio(digitado: unknown): { ok: true; alvo: AlvoDoBloqueio } | { ok: false; motivo: "ip_invalido" | "ip_reservado" | "faixa_larga" } {
  const texto = typeof digitado === "string" ? digitado.trim().toLowerCase() : "";
  if (!texto || texto.length > 60) return { ok: false, motivo: "ip_invalido" };
  const [endereco, mascara, sobra] = texto.split("/");
  if (sobra !== undefined) return { ok: false, motivo: "ip_invalido" };
  const v4 = ipv4(endereco);
  if (v4) {
    if (reservado4(v4)) return { ok: false, motivo: "ip_reservado" };
    if (mascara === undefined) return { ok: true, alvo: { target: "ip", value: v4.join(".") } };
    if (mascara !== "16" && mascara !== "24") return { ok: false, motivo: "faixa_larga" };
    const corte = mascara === "16" ? [v4[0], v4[1], 0, 0] : [v4[0], v4[1], v4[2], 0];
    return { ok: true, alvo: { target: "ip_range", value: `${corte.join(".")}/${mascara}` } };
  }
  const v6 = grupos6(endereco);
  if (v6) {
    if (reservado6(v6)) return { ok: false, motivo: "ip_reservado" };
    const escrito = v6.map((x) => x.toString(16)).join(":");
    if (mascara === undefined) return { ok: true, alvo: { target: "ip6", value: escrito } };
    if (mascara !== "32" && mascara !== "48" && mascara !== "64") return { ok: false, motivo: "faixa_larga" };
    const manter = Number(mascara) / 16;
    const corte = v6.map((x, i) => (i < manter ? x : 0));
    return { ok: true, alvo: { target: "ip_range", value: `${corte.map((x) => x.toString(16)).join(":")}/${mascara}` } };
  }
  return { ok: false, motivo: "ip_invalido" };
}

type Buscar = typeof fetch;

/** A nota que fica na regra, na Cloudflare: sem conta, sem nome, só o prazo. */
export const notaDaRegra = (horas: number) => `Alumia: bloqueio com prazo de ${horas} h; sai sozinho quando vence.`;

/** Cria a regra. Devolve o número dela na Cloudflare, ou o motivo da falha (sem o texto da Cloudflare, que pode citar o endereço). */
export async function criarRegra(alvo: AlvoDoBloqueio, horas: number, cfg: ConfigDaCloudflare, buscar: Buscar = fetch): Promise<{ ok: true; regra: string } | { ok: false; motivo: string }> {
  try {
    const r = await buscar(`${API_DA_CLOUDFLARE}/zones/${cfg.zona}/firewall/access_rules/rules`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "block", configuration: alvo, notes: notaDaRegra(horas) }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const corpo = (await r.json().catch(() => null)) as { success?: unknown; result?: { id?: unknown } } | null;
    const regra = typeof corpo?.result?.id === "string" ? corpo.result.id : "";
    if (!r.ok || corpo?.success !== true || !/^[A-Za-z0-9]{8,64}$/.test(regra)) {
      return { ok: false, motivo: r.status === 401 || r.status === 403 ? "cloudflare_sem_permissao" : "cloudflare_recusou" };
    }
    return { ok: true, regra };
  } catch {
    return { ok: false, motivo: "cloudflare_fora_do_ar" };
  }
}

/** Apaga a regra. A regra que já não existe (apagada à mão no painel da Cloudflare) conta como apagada. */
export async function apagarRegra(regra: string, cfg: ConfigDaCloudflare, buscar: Buscar = fetch): Promise<boolean> {
  if (!/^[A-Za-z0-9]{8,64}$/.test(regra)) return false;
  try {
    const r = await buscar(`${API_DA_CLOUDFLARE}/zones/${cfg.zona}/firewall/access_rules/rules/${regra}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return r.ok || r.status === 404;
  } catch {
    return false;
  }
}
