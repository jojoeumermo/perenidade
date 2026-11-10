// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A faxina dos stories da Alumia (PLANO-ALUMIA §5 F5). O banco chama de 15 em 15 minutos (pg_cron "alumia-faxina-stories" →
// interno.rede5_story_faxina, em supabase/migracoes/20261109-alumia-f5.sql). A lógica está em ./faxina.mjs (testada no Node).
//
// Publicar (o Jonathan): supabase functions deploy faxina-stories. SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega.
// Segredo próprio (recomendado): FAXINA_STORIES_SEGREDO, o mesmo valor guardado no banco em interno.configuracoes ('stories'.'segredo');
// com ele, só o banco consegue disparar a rodada. Sem ele, qualquer um com a chave pública dispara, e o estrago é só uma rodada
// a mais (a função só apaga o que já venceu e só confere o que já está lá).
// Nada daqui registra caminho, conteúdo nem pessoa: o log é só contagem.
import { rodada } from "./faxina.mjs";

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const segredo = Deno.env.get("FAXINA_STORIES_SEGREDO") ?? "";
const DEPOSITO = "rede-stories";

function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });
const cabecalhos = () => ({ apikey: servico, Authorization: `Bearer ${servico}` });
/** O caminho no endereço, parte por parte (o nome é "<uid>/<id>.<ext>", só letras, números, - e .). */
const noEndereco = (caminho: string) => caminho.split("/").map(encodeURIComponent).join("/");

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

async function baixar(caminho: string): Promise<Uint8Array> {
  const r = await fetch(`${base}/storage/v1/object/${DEPOSITO}/${noEndereco(caminho)}`, { headers: cabecalhos(), signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`baixar: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function subir(caminho: string, bytes: Uint8Array, tipo: string): Promise<void> {
  const r = await fetch(`${base}/storage/v1/object/${DEPOSITO}/${noEndereco(caminho)}`, {
    method: "PUT",
    headers: { ...cabecalhos(), "Content-Type": tipo, "x-upsert": "true", "cache-control": "max-age=3600" },
    body: bytes,
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`subir: HTTP ${r.status}`);
}

async function remover(caminhos: string[]): Promise<void> {
  const r = await fetch(`${base}/storage/v1/object/${DEPOSITO}`, {
    method: "DELETE",
    headers: { ...cabecalhos(), "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: caminhos }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`remover: HTTP ${r.status}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (segredo && !igual(req.headers.get("x-lucia-segredo") ?? "", segredo)) return responder({ erro: "sem_permissao" }, 403);
  if (!base || !servico) return responder({ erro: "nao_configurado" }, 503);
  try {
    const r = await rodada({ chamar, baixar, subir, remover });
    console.log(`faxina-stories: ${r.apagados} apagado(s), ${r.conferidos} conferido(s), ${r.limpos} limpo(s), ${r.ruins} fora do ar, ${r.orfaos} órfão(s).`);
    return responder(r);
  } catch {
    return responder({ erro: "falhou" }, 500);
  }
});
