// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Conferir o domínio próprio de uma organização (Alumia, onda 12, frente 12E). Ordem:
//   1. COMO a pessoa (rede_org_dominio_para_conferir): só quem gerencia, só organização com selo, no máximo 10 por hora; o banco
//      devolve a organização, o domínio e o desafio (nada disso vem do corpo do pedido, só o @);
//   2. o servidor procura o desafio no TXT `_alumia.<domínio>` e no arquivo `/.well-known/alumia-dominio.txt` do site da
//      organização (lib/rede/org/dominio.ts: só HTTPS, sem redirecionar, endereço interno recusado antes de conectar);
//   3. com a chave de serviço (rede_org_dominio_resultado), grava só "achou" e o jeito. Nenhum endereço de rede é guardado nem
//      escrito em log.
// Atrás das flags: com "alumia-org" desligada a rota responde 404, como se não existisse.
import { ligado } from "@/lib/recursos";
import { configDoAmbiente } from "@/lib/rede/contas-extra";
import type { DominioDaComunicacao } from "@/lib/rede/org/comunicacao";
import { ferramentasDoServidor, provarDominio } from "@/lib/rede/org/dominio";
import { chamarComoPessoa, lerCorpoLimitado, statusDoCodigo, tokenDe } from "@/lib/rede/publicar/servidor";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";

export const runtime = "nodejs";

const resposta = (corpo: unknown, status = 200) => Response.json(corpo, { status, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });

/** Chama uma função do banco com a chave de serviço (só aqui, no servidor). */
async function chamarComoServico<T>(url: string, chave: string, funcao: string, argumentos: Record<string, unknown>): Promise<{ ok: true; dado: T } | { ok: false; codigo: string }> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: chave, Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const corpo = (await r.json().catch(() => null)) as unknown;
    if (r.ok) return { ok: true, dado: corpo as T };
    const m = typeof corpo === "object" && corpo !== null && "message" in corpo ? String((corpo as { message: unknown }).message) : "";
    return { ok: false, codigo: /^[a-z_]+(:[a-z_]+)?$/.test(m) ? m : "falha" };
  } catch {
    return { ok: false, codigo: "sem_conexao" };
  }
}

export async function POST(pedido: Request) {
  if (!alumia2Ligada() || !ligado("alumia-org")) return resposta({ erro: "nao_encontrado" }, 404);
  const token = tokenDe(pedido);
  if (!token) return resposta({ erro: "entre_primeiro" }, 401);
  const cru = await lerCorpoLimitado(pedido, 1024);
  if (!cru) return resposta({ erro: "grande" }, 413);
  let handle = "";
  try {
    const json = JSON.parse(new TextDecoder().decode(cru)) as unknown;
    handle = typeof json === "object" && json !== null && typeof (json as { handle?: unknown }).handle === "string" ? (json as { handle: string }).handle.trim() : "";
  } catch {
    return resposta({ erro: "invalido:pedido" }, 400);
  }
  if (!/^@?[a-z0-9_]{2,40}$/i.test(handle)) return resposta({ erro: "invalido:pedido" }, 400);

  const alvo = await chamarComoPessoa<{ org: string; dominio: string; desafio: string }>(token, "rede_org_dominio_para_conferir", { p_handle: handle });
  if (!alvo.ok) return resposta({ erro: alvo.codigo }, statusDoCodigo(alvo.codigo));

  const config = configDoAmbiente();
  if (!config) return resposta({ erro: "sem_servico" }, 503);
  const prova = await provarDominio(alvo.dado.dominio, alvo.dado.desafio, await ferramentasDoServidor());
  const gravado = await chamarComoServico<DominioDaComunicacao>(config.url, config.chave, "rede_org_dominio_resultado", {
    p_org: alvo.dado.org,
    p_dominio: alvo.dado.dominio,
    p_desafio: alvo.dado.desafio,
    p_ok: prova.ok,
    p_metodo: prova.ok ? prova.metodo : null,
  });
  if (!gravado.ok) return resposta({ erro: gravado.codigo }, statusDoCodigo(gravado.codigo));
  return resposta(prova.ok ? { ok: true, metodo: prova.metodo, dominio: gravado.dado } : { ok: false, motivo: prova.motivo, dominio: gravado.dado });
}
