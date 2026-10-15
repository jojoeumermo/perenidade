// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// E-mails pelo Resend: a fila do banco (convites) e os avisos de alerta. O aviso de alerta nunca leva detalhe:
// só o tipo, a gravidade e a hora. O resto a pessoa vê no app, depois de entrar com o segundo fator.
import type { Alerta, Env } from "./tipos.ts";
import { Banco } from "./banco.ts";
import { pegar } from "./util.ts";

const NOME_GRAVIDADE: Record<string, string> = { baixa: "baixa", media: "média", alta: "ALTA", critica: "CRÍTICA" };

export async function enviar(env: Env, para: string, assunto: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  if (!env.RESEND_API_KEY) return { ok: false, erro: "RESEND_API_KEY não configurada" };
  const resposta = await pegar("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_REMETENTE || "Sentinela Lúcia <sentinela@institutolucia.org>", to: [para], subject: assunto, text: texto }),
  }, 15_000);
  if (!resposta) return { ok: false, erro: "o Resend não respondeu" };
  if (!resposta.ok) return { ok: false, erro: `Resend respondeu ${resposta.status}` };
  return { ok: true };
}

/** Manda os e-mails que o banco deixou na fila (convites) e devolve quantos saíram. */
export async function enviarFila(env: Env, banco: Banco): Promise<number> {
  const fila = await banco.rpc<{ id: string; para: string; assunto: string; texto: string }[]>("emails_pendentes", { p_limite: 20 });
  let enviados = 0;
  for (const e of fila) {
    const r = await enviar(env, e.para, e.assunto, e.texto);
    await banco.rpc("email_resultado", { p_id: e.id, p_ok: r.ok, p_erro: r.erro ?? "" });
    if (r.ok) enviados++;
  }
  return enviados;
}

/** O texto do aviso: nada sensível na prévia. */
export function textoDoAviso(alerta: Alerta, appUrl: string): { assunto: string; texto: string } {
  const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return {
    assunto: `Sentinela Lúcia: alerta de gravidade ${NOME_GRAVIDADE[alerta.gravidade] ?? alerta.gravidade}`,
    texto: `Um alerta de gravidade ${NOME_GRAVIDADE[alerta.gravidade] ?? alerta.gravidade} foi registrado às ${quando} (horário de Brasília), pela regra "${alerta.regra}".\n\nPor segurança, este e-mail não traz os detalhes. Abra o aplicativo Sentinela Lúcia${appUrl ? ` (${appUrl})` : ""}, entre com o seu código do aplicativo autenticador e veja a tela Alertas.\n\nSe você não quer receber estes avisos, desligue-os em Equipe → Meus avisos.`,
  };
}

/** Grava os alertas no banco e avisa por e-mail quem optou. */
export async function registrarAlertas(env: Env, banco: Banco, alertas: Alerta[]): Promise<{ novos: number; emails: number }> {
  let novos = 0;
  let emails = 0;
  for (const alerta of alertas) {
    const r = await banco.rpc<{ id?: number; ignorado?: string; avisar?: { email: string; nome: string }[] }>("alerta_criar", { p: alerta });
    if (!r.id) continue;
    novos++;
    const { assunto, texto } = textoDoAviso(alerta, env.APP_URL ?? "");
    for (const pessoa of r.avisar ?? []) {
      if (!pessoa.email) continue;
      const enviado = await enviar(env, pessoa.email, assunto, texto);
      if (enviado.ok) emails++;
    }
  }
  return { novos, emails };
}
