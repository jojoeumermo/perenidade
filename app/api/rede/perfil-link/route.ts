// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência de um link do perfil pelo rel="me" (onda 12, 12D; supabase/migracoes/20261118-alumia-o12-perfil.sql).
//   POST {link}, com a sessão no cabeçalho Authorization →
//   1. o banco, COMO a pessoa, devolve o endereço do link dela e o @ (alumia_perfil_link_conferir; só a dona pede, com teto);
//   2. o servidor busca a página de lá (lib/rede/publicar/buscar-seguro.ts: só https e portas conhecidas, DNS conferido na hora de
//      conectar, nada de endereço interno, tempo e tamanho limitados), SEM mandar nada da pessoa: nenhum cookie, nenhum token,
//      nenhuma página de origem, um nome de cliente genérico;
//   3. lê só as etiquetas <a> e <link> com rel="me" (lib/rede/secoes-perfil.ts) e entrega ao banco, com a chave de serviço, se o
//      site aponta de volta para o perfil (alumia_perfil_link_resultado, que só aceita nos 2 minutos depois do pedido da dona).
// Nada é guardado aqui: nem a página de fora, nem o endereço de quem pediu.
import { site } from "@/lib/site";
import { buscarSeguro } from "@/lib/rede/publicar/buscar-seguro";
import { chamarComoPessoa, tokenDe } from "@/lib/rede/publicar/servidor";
import { linkPedeMediacao, paginaApontaDeVolta } from "@/lib/rede/secoes-perfil";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const semCache = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" };
const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: semCache });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Os endereços em que o perfil existe: o próprio da Alumia (se ligado) e o do site. */
function bases(): string[] {
  const lista = [site.url];
  const alumia = (process.env.NEXT_PUBLIC_ALUMIA_URL ?? "").trim().replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9.-]+$/i.test(alumia)) lista.push(alumia);
  return lista;
}

// Freio na memória deste processo: no máximo 6 conferências por sessão a cada 10 minutos (o banco também limita).
const usos = new Map<string, number[]>();
function passou(chave: string): boolean {
  const agora = Date.now();
  const recentes = (usos.get(chave) ?? []).filter((t) => agora - t < 10 * 60_000);
  if (recentes.length >= 6) return false;
  recentes.push(agora);
  usos.set(chave, recentes);
  if (usos.size > 5000) for (const [k, v] of usos) if (v.every((t) => agora - t >= 10 * 60_000)) usos.delete(k);
  return true;
}

export async function POST(pedido: Request) {
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!SUPA || !servico) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const lugar = pedido.headers.get("sec-fetch-site");
  if (lugar && lugar !== "same-origin") return resposta({ ok: false, motivo: "origem" }, 403);
  const token = tokenDe(pedido);
  if (!token) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  const corpo = (await pedido.json().catch(() => null)) as { link?: unknown } | null;
  const link = typeof corpo?.link === "string" && UUID.test(corpo.link) ? corpo.link : null;
  if (!link) return resposta({ ok: false, motivo: "invalido" }, 400);
  if (!passou(token.slice(-32))) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);

  // 1. Como a pessoa: o banco confere que o link é dela e devolve o endereço e o @.
  const r = await chamarComoPessoa<{ url: string; handle: string }>(token, "alumia_perfil_link_conferir", { p_link: link });
  if (!r.ok) return resposta({ ok: false, motivo: r.codigo }, r.status === 401 ? 401 : 400);
  const { url, handle } = r.dado;
  if (linkPedeMediacao(url)) return resposta({ ok: false, motivo: "mediacao" });

  // 2. A página de fora, sem nada da pessoa.
  const busca = await buscarSeguro(url, {
    tipos: ["text/html", "application/xhtml+xml"],
    maxBytes: 512 * 1024,
    tempoMs: 6000,
    cabecalhos: { "User-Agent": "AlumiaRelMe/1.0", Accept: "text/html,application/xhtml+xml;q=0.9", "Accept-Language": "*" },
  });
  // Redirecionar só vale dentro do mesmo site e em https: a página que aponta de volta tem de ser do dono do link que foi salvo.
  const mesmoSite = busca ? busca.url.protocol === "https:" && busca.url.host === new URL(url).host : false;
  const ok = busca && mesmoSite ? paginaApontaDeVolta(new TextDecoder("utf-8", { fatal: false }).decode(busca.corpo), busca.url.href, handle, bases()) : false;

  // 3. Só o servidor marca, e só logo depois do pedido da dona (o banco confere).
  const usuario = await fetch(`${SUPA}/auth/v1/user`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "", Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) })
    .then((x) => (x.ok ? (x.json() as Promise<{ id?: string }>) : null))
    .catch(() => null);
  if (!usuario?.id || !UUID.test(usuario.id)) return resposta({ ok: false, motivo: "entre_primeiro" }, 401);
  try {
    const marca = await fetch(`${SUPA}/rest/v1/rpc/alumia_perfil_link_resultado`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_usuario: usuario.id, p_link: link, p_ok: ok }),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!marca.ok) return resposta({ ok: false, motivo: "banco" }, 502);
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
  return resposta(ok ? { ok: true } : { ok: false, motivo: busca ? "nao_achou" : "indisponivel" });
}
