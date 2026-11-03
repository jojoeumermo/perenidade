// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// CORS das funções chamadas pelo navegador (assistente, avaliar-comunidade, transcrever-audio, transcrever-podcast e
// youtube). Antes, todas respondiam "Access-Control-Allow-Origin: *": qualquer site podia chamar as funções pelo navegador
// de quem o visitasse. Agora só as páginas do próprio site.
//
// A lista vem do segredo ORIGENS_PERMITIDAS (endereços separados por vírgula). Sem ele, valem o endereço principal e o www:
//   ORIGENS_PERMITIDAS=https://institutolucia.org,https://www.institutolucia.org
// localhost e 127.0.0.1 só passam fora de produção: no servidor local (supabase start, em que SUPABASE_URL é http://) ou
// com CORS_LOCAL=1 em supabase/functions/.env.
//
// CORS só segura navegador: curl e robôs passam do mesmo jeito. A proteção de verdade continua sendo a sessão e a função
// no painel que cada função confere no banco. enviar-emails não usa isto: quem a chama é o próprio banco, não um navegador.

const PADRAO = "https://institutolucia.org,https://www.institutolucia.org";
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** @param {string} nome */
const ambiente = (nome) => {
  try {
    return globalThis.Deno?.env.get(nome) ?? "";
  } catch {
    return "";
  }
};

/** Os endereços aceitos, já limpos (sem barra no fim). */
export function origensPermitidas() {
  return (ambiente("ORIGENS_PERMITIDAS") || PADRAO)
    .split(",")
    .map((item) => item.trim().replace(/\/$/, ""))
    .filter((item) => /^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(item));
}

/** Estamos fora de produção? (servidor local do Supabase, ou CORS_LOCAL=1) */
const foraDeProducao = () => ambiente("CORS_LOCAL") === "1" || /^http:\/\//.test(ambiente("SUPABASE_URL"));

/**
 * A origem do pedido, se ela pode ler a resposta; senão, vazio.
 * @param {Request} pedido
 */
export function origemAceita(pedido) {
  const origem = pedido.headers.get("origin") ?? "";
  if (!origem) return "";
  if (origensPermitidas().includes(origem)) return origem;
  if (LOCAL.test(origem) && foraDeProducao()) return origem;
  return "";
}

/**
 * Os cabeçalhos de CORS para este pedido. Origem fora da lista: sem Access-Control-Allow-Origin, e o navegador bloqueia.
 * @param {Request} pedido
 * @returns {Record<string, string>}
 */
export function cors(pedido) {
  const origem = origemAceita(pedido);
  return {
    ...(origem ? { "Access-Control-Allow-Origin": origem } : {}),
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
  };
}

/**
 * Envolve o tratamento de uma função: responde o OPTIONS (pré-voo) e põe os cabeçalhos de CORS do pedido em toda
 * resposta, por cima de qualquer "Access-Control-Allow-Origin" que ela tenha trazido.
 * @param {(pedido: Request) => Response | Promise<Response>} tratar
 * @returns {(pedido: Request) => Promise<Response>}
 */
export function comCors(tratar) {
  return async (pedido) => {
    const cabecalhos = cors(pedido);
    if (pedido.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhos });
    const resposta = await tratar(pedido);
    const juntos = new Headers(resposta.headers);
    juntos.delete("Access-Control-Allow-Origin");
    for (const [nome, valor] of Object.entries(cabecalhos)) juntos.set(nome, valor);
    return new Response(resposta.body, { status: resposta.status, statusText: resposta.statusText, headers: juntos });
  };
}
