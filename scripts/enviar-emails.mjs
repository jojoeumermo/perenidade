// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envia os e-mails automáticos que o banco deixou na fila (confirmação de candidatura, convite, boletim, reforço).
// Quem envia de verdade, de minuto em minuto, é a função "enviar-emails" do Supabase, chamada pelo próprio banco. Este
// arquivo é a reserva: roda na rotina "Enviar e-mails" do GitHub (.github/workflows/emails.yml), que o GitHub atrasa por horas.
// O desenho dos e-mails e a rodada de envio moram em supabase/functions/_shared/emails.mjs.
//
// Variáveis (segredos e variáveis da rotina, nunca arquivos do projeto):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   as mesmas da publicação automática
//   RESEND_API_KEY                            a chave do serviço de envio (resend.com)
//   EMAIL_REMETENTE                           Instituto Lúcia <noreply@institutolucia.org> (domínio verificado no Resend)
//   EMAIL_RESPOSTA                            para onde vão as respostas: institutolucia@tutamail.com
//
// Nada daqui registra endereço, texto nem chave: o registro diz só quantos saíram e o tipo de falha.
import { pathToFileURL } from "node:url";
import { rodada } from "../supabase/functions/_shared/emails.mjs";

export { boletim, html, pedido, RESEND, rodada } from "../supabase/functions/_shared/emails.mjs";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const base = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "");
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  const chave = process.env.RESEND_API_KEY ?? "";
  const remetente = process.env.EMAIL_REMETENTE ?? "";
  if (!base || !servico || !chave || !remetente) {
    console.log("Envio de e-mails não configurado (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY e EMAIL_REMETENTE): nada foi enviado.");
    process.exit(0);
  }
  const chamar = async (funcao, argumentos = {}) => {
    const r = await fetch(`${base}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: servico, Authorization: `Bearer ${servico}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) throw new Error(`${funcao}: HTTP ${r.status}`);
    return r.json();
  };
  const resultado = await rodada({ chamar, chave, remetente, resposta: process.env.EMAIL_RESPOSTA ?? "" });
  console.log(`${resultado.enviados} enviado(s), ${resultado.falhas} com falha${resultado.falhas ? ` (${Object.entries(resultado.erros).map(([tipo, n]) => `${tipo}: ${n}`).join(", ")})` : ""}.`);
  if (resultado.erros.chave_recusada) process.exit(1);
}
