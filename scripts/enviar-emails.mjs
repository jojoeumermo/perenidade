// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Envia os e-mails automáticos que o banco deixou na fila (confirmação de candidatura, convite, boletim, reforço).
// Roda na rotina "Enviar e-mails" (.github/workflows/emails.yml), de dez em dez minutos.
//
// Variáveis (segredos e variáveis da rotina, nunca arquivos do projeto):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   as mesmas da publicação automática
//   RESEND_API_KEY                            a chave do serviço de envio (resend.com)
//   EMAIL_REMETENTE                           ex.: Instituto Lúcia <contato@institutolucia.org> (domínio verificado no Resend)
//   EMAIL_RESPOSTA                            opcional: para onde vão as respostas (ex.: o endereço recebido pelo Cloudflare Email Routing)
//
// Nada daqui registra endereço, texto nem chave: o registro diz só quantos saíram e o tipo de falha.
import { pathToFileURL } from "node:url";

export const RESEND = "https://api.resend.com/emails";

const escapar = (texto) => texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** O e-mail em HTML simples, a partir do texto: parágrafos, links clicáveis e nada vindo de fora. */
export function html(texto) {
  const paragrafos = escapar(texto)
    .split(/\n{2,}/)
    .map((bloco) => bloco.replace(/(https:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>"));
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f4ecd8;color:#1f1a14;font-family:Georgia,serif;font-size:17px;line-height:1.5"><div style="max-width:600px;margin:0 auto">${paragrafos.map((p) => `<p>${p}</p>`).join("")}</div></body></html>`;
}

/** Monta o pedido de um e-mail para o serviço de envio. */
export function pedido(email, { remetente, resposta }) {
  const corpo = { from: remetente, to: [email.para], subject: email.assunto, text: email.texto, html: html(email.texto) };
  if (resposta) corpo.reply_to = resposta;
  // Boletim: o leitor de e-mail mostra o botão "cancelar inscrição", que leva ao mesmo link de saída do texto.
  if (email.sair) corpo.headers = { "List-Unsubscribe": `<${email.sair}>` };
  return corpo;
}

/**
 * Uma rodada: pega a fila, envia um por um e devolve ao banco o resultado de cada e-mail.
 * @param {{ chamar: (funcao: string, argumentos?: object) => Promise<unknown>, buscar?: typeof fetch, chave: string, remetente: string, resposta?: string, pausa?: number, limite?: number }} o
 */
export async function rodada({ chamar, buscar = fetch, chave, remetente, resposta = "", pausa = 600, limite = 50 }) {
  const fila = await chamar("emails_pendentes", { p_limite: limite });
  const contagem = { enviados: 0, falhas: 0, erros: {} };
  for (const email of Array.isArray(fila) ? fila : []) {
    let erro = "";
    try {
      const r = await buscar(RESEND, {
        method: "POST",
        // A chave de idempotência é o próprio e-mail: se a rodada cair no meio e o e-mail for pego de novo, o serviço não manda duas vezes.
        headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json", "Idempotency-Key": `lucia-${email.id}` },
        body: JSON.stringify(pedido(email, { remetente, resposta })),
        signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) erro = r.status === 429 ? "limite" : r.status === 401 || r.status === 403 ? "chave_recusada" : r.status === 422 ? "recusado" : `http_${r.status}`;
    } catch (falha) {
      erro = falha?.name === "TimeoutError" || falha?.name === "AbortError" ? "tempo_esgotado" : "sem_conexao";
    }
    await chamar("email_resultado", { p_id: email.id, p_ok: !erro, p_erro: erro });
    if (erro) {
      contagem.falhas++;
      contagem.erros[erro] = (contagem.erros[erro] ?? 0) + 1;
      // Chave errada ou limite estourado: insistir agora só gasta tentativas. O resto espera a próxima rodada.
      if (erro === "chave_recusada" || erro === "limite") break;
    } else {
      contagem.enviados++;
    }
    if (pausa) await new Promise((fim) => setTimeout(fim, pausa));
  }
  return contagem;
}

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
