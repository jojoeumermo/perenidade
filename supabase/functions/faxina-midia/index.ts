// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A faxina da mídia órfã da Alumia (Onda 8, frente de operação). O banco chama uma vez por dia (pg_cron "lucia-alumia-faxina-midia"
// → interno.alumia_midia_faxina_disparar, em supabase/migracoes/20261114-alumia-o8-operacao.sql). A função pede ao banco os
// arquivos do depósito rede-midia que nenhum post nem áudio usa há mais de 24 horas (public.rede_midia_faxina_lista), apaga pela
// API do depósito (apagar direto na tabela deixaria o arquivo para trás) e devolve ao banco quantos apagou
// (public.rede_midia_faxina_feito), número que o painel e o monitor leem.
//
// Publicar (o Jonathan): supabase functions deploy faxina-midia. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega.
// Segredo próprio (recomendado): FAXINA_MIDIA_SEGREDO, o mesmo valor guardado no banco em interno.configuracoes
// ('faxina_midia'.'segredo'); com ele, só o banco dispara a rodada. Sem ele, quem tem a chave pública dispara uma rodada a mais,
// e a rodada só apaga o que já é órfão.
// Nada daqui registra caminho, conteúdo nem pessoa: o log é só contagem.

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const segredo = Deno.env.get("FAXINA_MIDIA_SEGREDO") ?? "";
const DEPOSITO = "rede-midia";
/** Cada pedido de remoção leva até 100 caminhos; cada rodada, até 1000 arquivos. */
const LOTE = 100;
const MAXIMO = 1000;
const CAMINHO = /^[0-9a-f-]{36}\/[0-9A-Za-z._-]{1,120}$/;

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const cabecalhos = () => ({ apikey: servico, Authorization: `Bearer ${servico}` });

async function chamar(funcao: string, argumentos: Record<string, unknown> = {}) {
  const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { ...cabecalhos(), "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${funcao}: HTTP ${r.status}`);
  return r.json();
}

/** Apaga um lote pela API do depósito. Devolve quantos saíram e quantos bytes eles ocupavam. */
async function remover(caminhos: string[]): Promise<{ apagados: number; bytes: number }> {
  const r = await fetch(`${base}/storage/v1/object/${DEPOSITO}`, {
    method: "DELETE",
    headers: { ...cabecalhos(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: caminhos }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`remover: HTTP ${r.status}`);
  const saidos = (await r.json().catch(() => [])) as { metadata?: { size?: number } }[];
  const lista = Array.isArray(saidos) ? saidos : [];
  return { apagados: lista.length, bytes: lista.reduce((n, o) => n + (Number(o?.metadata?.size) || 0), 0) };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (segredo && !igual(req.headers.get("x-lucia-segredo") ?? "", segredo)) return responder({ erro: "sem_permissao" }, 403);
  if (!base || !servico) return responder({ erro: "nao_configurado" }, 503);
  try {
    const lista = await chamar("rede_midia_faxina_lista", { p_limite: MAXIMO });
    const caminhos = (Array.isArray(lista) ? lista : []).filter((c): c is string => typeof c === "string" && CAMINHO.test(c));
    let apagados = 0;
    let bytes = 0;
    let falhas = 0;
    for (let i = 0; i < caminhos.length; i += LOTE) {
      try {
        const r = await remover(caminhos.slice(i, i + LOTE));
        apagados += r.apagados;
        bytes += r.bytes;
      } catch {
        falhas += 1;
      }
    }
    await chamar("rede_midia_faxina_feito", { p_apagados: apagados, p_bytes: bytes, p_falhas: falhas });
    console.log(`faxina-midia: ${apagados} apagado(s), ${bytes} bytes, ${falhas} lote(s) com falha.`);
    return responder({ apagados, bytes, falhas });
  } catch {
    return responder({ erro: "falhou" }, 500);
  }
});
