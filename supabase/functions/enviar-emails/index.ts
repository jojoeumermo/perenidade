// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envia os e-mails automáticos que o banco deixou na fila. O próprio banco chama esta função de minuto em minuto
// (agendamento "lucia-emails" no install.sql), então um convite ou uma confirmação sai em até um minuto. A rotina do
// GitHub continua como reserva, mas o GitHub atrasa rotinas agendadas por horas.
//
// Publicar: supabase functions deploy enviar-emails (o banco chama com a chave pública do projeto).
// Segredo (Edge Functions → Secrets): RESEND_API_KEY, o mesmo da rotina do GitHub. EMAIL_REMETENTE e EMAIL_RESPOSTA são
// opcionais: sem eles, valem o remetente e a caixa de respostas do instituto.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY o Supabase já entrega a toda função.
//
// Qualquer um pode chamar o endereço, e não adianta: a função só esvazia a fila que já existe, um e-mail por vez, e o
// banco não entrega o mesmo e-mail a duas rodadas ao mesmo tempo. Nada daqui registra endereço, texto nem chave.
import { rodada } from "../_shared/emails.mjs";

const base = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const chave = Deno.env.get("RESEND_API_KEY") ?? "";
const remetente = Deno.env.get("EMAIL_REMETENTE") || "Instituto Lúcia <noreply@institutolucia.org>";
const resposta = Deno.env.get("EMAIL_RESPOSTA") || "institutolucia@tutamail.com";

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
  if (!base || !servico || !chave || !remetente) return responder({ erro: "nao_configurado" }, 503);
  try {
    const resultado = await rodada({ chamar, chave, remetente, resposta, pausa: 300, limite: 40 });
    console.log(`${resultado.enviados} enviado(s), ${resultado.falhas} com falha.`);
    return responder(resultado, resultado.erros.chave_recusada ? 502 : 200);
  } catch {
    return responder({ erro: "falhou" }, 500);
  }
});
