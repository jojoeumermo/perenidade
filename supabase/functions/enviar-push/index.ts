// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envia o aviso no celular da Rede ("Você tem N avisos na Rede", sem o texto de nenhum post). O banco chama esta função de dois
// em dois minutos (interno.rede3_push_disparar, agendamento "lucia-rede-push"); ela pergunta ao banco quem deve ser avisado
// (rede_aviso_push_pendentes), envia pelo serviço de entrega do navegador (Web Push, VAPID) e devolve o resultado de cada envio.
// O desenho do envio mora em supabase/functions/_shared/push.mjs.
//
// Publicar: supabase functions deploy enviar-push
// Segredos (Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (o par gerado uma vez, veja docs/rede/AVISOS.md),
// VAPID_ASSUNTO (mailto:institutolucia@tutamail.com) e PUSH_SEGREDO (opcional, recomendado: o banco manda o mesmo valor no
// cabeçalho x-lucia-segredo, guardado em interno.configuracoes, chave 'push'). SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o
// Supabase já entrega a toda função. Nada daqui registra endereço de aparelho, chave nem conteúdo.
import { rodada } from "../_shared/push.mjs";

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const chavePublica = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const chavePrivada = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const assunto = Deno.env.get("VAPID_ASSUNTO") || "mailto:institutolucia@tutamail.com";
const segredo = Deno.env.get("PUSH_SEGREDO") ?? "";

/** Compara sem parar no primeiro caractere diferente (o tempo da resposta não entrega o segredo aos poucos). */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

async function chamar(funcao: string, argumentos: Record<string, unknown> = {}) {
  const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
    method: "POST",
    headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
    body: JSON.stringify(argumentos),
    signal: AbortSignal.timeout(30_000),
  });
  if (!r.ok) throw new Error(`${funcao}: HTTP ${r.status}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return responder({ erro: "metodo" }, 405);
  if (segredo && !igual(req.headers.get("x-lucia-segredo") ?? "", segredo)) return responder({ erro: "sem_permissao" }, 403);
  if (!base || !servico || !chavePublica || !chavePrivada) return responder({ erro: "nao_configurado" }, 503);
  try {
    const resultado = await rodada({ chamar, vapid: { chavePublica, chavePrivada, assunto }, limite: 50 });
    console.log(`${resultado.enviados} enviado(s), ${resultado.falhas} com falha, ${resultado.removidos} aparelho(s) removido(s).`);
    return responder(resultado);
  } catch {
    return responder({ erro: "falhou" }, 500);
  }
});
