// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os dois e-mails que se pedem sem estar dentro, pelo servidor do site (onda 9):
//   POST {desafio, resposta, turnstile?, tipo: "confirmacao" | "senha", email, volta} → {ok} ou {ok: false, motivo}
//     "confirmacao"  manda de novo o link de confirmação do cadastro
//     "senha"        manda o link de senha nova
// Antes, o desafio da Cloudflare (Turnstile, conferido aqui quando TURNSTILE_SECRET_KEY existe), a prova de trabalho, a rede barrada e o freio da rede nesta hora (lib/rede/convites/porta-sem-teto.ts); e um freio por
// e-mail, na memória do processo, para ninguém encher a caixa de outra pessoa. A resposta é a mesma haja conta ou não: a tela não
// diz quem tem conta. O endereço de volta só vale na mesma origem de quem pediu.
import { createHash } from "node:crypto";
import { criarFreio, deOutraOrigem, resposta, servico, SUPA } from "@/lib/rede/convites/servidor";
import { EMAIL_VALIDO, passarSemTeto, servicoDeContas, voltaDaMesmaOrigem } from "@/lib/rede/convites/porta-sem-teto";
import { conferirDesafioDaCloudflare } from "@/lib/rede/convites/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Três e-mails por endereço a cada hora (a chave é o resumo do endereço, não o endereço).
const freioDoEmail = criarFreio(3, 60 * 60_000);

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  if (!SUPA || !servico()) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const c = (await pedido.json().catch(() => null)) as { desafio?: unknown; resposta?: unknown; turnstile?: unknown; tipo?: unknown; email?: unknown; volta?: unknown } | null;
  const email = typeof c?.email === "string" ? c.email.trim().toLowerCase() : "";
  const tipo = c?.tipo === "confirmacao" || c?.tipo === "senha" ? c.tipo : null;
  if (!tipo || !EMAIL_VALIDO.test(email)) return resposta({ ok: false, motivo: "invalido" }, 400);
  if ((await conferirDesafioDaCloudflare(c?.turnstile)) === "recusado") return resposta({ ok: false, motivo: "captcha" }, 400);

  const porta = await passarSemTeto(pedido, "aviso", c?.desafio, c?.resposta);
  if (!porta.ok) return resposta({ ok: false, motivo: porta.motivo }, porta.status);
  // Passou do teto deste endereço: responde como se tivesse mandado (quem pede não descobre nada), sem mandar.
  if (!freioDoEmail(createHash("sha256").update(`${tipo}:${email}`).digest("hex"))) return resposta({ ok: true });

  const volta = voltaDaMesmaOrigem(pedido, c?.volta);
  const comVolta = volta ? `?redirect_to=${encodeURIComponent(volta)}` : "";
  try {
    const r = tipo === "senha" ? await servicoDeContas(`/recover${comVolta}`, { email }) : await servicoDeContas(`/resend${comVolta}`, { type: "signup", email });
    // Conta que não existe, e-mail já confirmado ou endereço recusado voltam como sucesso: a tela não diz quem tem conta.
    if ((r.status >= 200 && r.status < 300) || r.status === 400 || r.status === 404 || r.status === 422) return resposta({ ok: true });
    if (r.status === 429) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
    return resposta({ ok: false, motivo: "falha" }, 502);
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
}
