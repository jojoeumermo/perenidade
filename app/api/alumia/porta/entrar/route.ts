// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Entrar com e-mail e senha pelo servidor do site (onda 9; lib/rede/convites/porta-sem-teto.ts).
//   POST {desafio, resposta, turnstile?, email, senha} → {ok, sessao} ou {ok: false, motivo}
// Antes, o servidor confere o desafio da Cloudflare (Turnstile, conferido aqui na Cloudflare, quando TURNSTILE_SECRET_KEY existe;
// lib/rede/convites/turnstile.ts), a prova de trabalho do aparelho, a rede barrada, o freio da rede nesta hora e o bloqueio da CONTA no
// banco (10 erros em 15 minutos, public.alumia_porta_entrada). Depois pede a sessão ao serviço de contas com a chave de serviço e
// devolve só os dois tokens; o navegador põe a sessão no lugar e segue (o código do aplicativo autenticador, quando a conta tem,
// continua sendo pedido no navegador). Senha errada conta um erro na conta. A senha passa por aqui só para chegar ao serviço de
// contas: não é guardada nem escrita em log. O caminho direto da API (que pula o site) só entra no bloqueio da conta com o gancho
// do serviço de contas ligado.
// Depois de entrar, o aviso de entrada nova: onde o projeto não deixa criar o gatilho em auth.sessions, o banco avisa daqui
// (public.alumia_porta_entrou, supabase/migracoes/20261120-alumia-o14-conta.sql); com o gatilho, ele responde que já avisou.
import { deOutraOrigem, resposta, rpcDeServico, servico, SUPA } from "@/lib/rede/convites/servidor";
import { EMAIL_VALIDO, passarSemTeto, servicoDeContas } from "@/lib/rede/convites/porta-sem-teto";
import { conferirDesafioDaCloudflare } from "@/lib/rede/convites/turnstile";
import { lerToken } from "@/lib/rede/seguranca/servico-de-contas";
import { reconhecerNavegador } from "@/lib/sessao/aparelho-servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bloqueio = { bloqueado: boolean; segundos?: number };

/** O bloqueio da conta no banco. Banco ainda sem a função (migração não rodou) ou fora do ar: segue sem ele, como antes. */
async function contaNoBanco(email: string, passo: "conferir" | "falhou" | "certa"): Promise<Bloqueio | null> {
  const r = await rpcDeServico<Bloqueio>("alumia_porta_entrada", { p_email: email, p_passo: passo });
  return r.ok ? r.dado : null;
}

const minutos = (b: Bloqueio) => Math.max(1, Math.ceil((b.segundos ?? 900) / 60));

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  if (!SUPA || !servico()) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const c = (await pedido.json().catch(() => null)) as { desafio?: unknown; resposta?: unknown; turnstile?: unknown; email?: unknown; senha?: unknown } | null;
  const email = typeof c?.email === "string" ? c.email.trim() : "";
  const senha = typeof c?.senha === "string" ? c.senha : "";
  if (!EMAIL_VALIDO.test(email) || senha.length < 1 || senha.length > 200) return resposta({ ok: false, motivo: "invalido" }, 400);
  if ((await conferirDesafioDaCloudflare(c?.turnstile)) === "recusado") return resposta({ ok: false, motivo: "captcha" }, 400);

  const porta = await passarSemTeto(pedido, "entrar", c?.desafio, c?.resposta);
  if (!porta.ok) return resposta({ ok: false, motivo: porta.motivo }, porta.status);

  const antes = await contaNoBanco(email, "conferir");
  if (antes?.bloqueado) return resposta({ ok: false, motivo: "bloqueado", minutos: minutos(antes) }, 429);

  try {
    const agente = (pedido.headers.get("user-agent") ?? "").slice(0, 500);
    const r = await servicoDeContas("/token?grant_type=password", { email, password: senha }, "POST", agente);
    const d = r.dado;
    if (r.status >= 200 && r.status < 300 && typeof d?.access_token === "string" && typeof d.refresh_token === "string") {
      await contaNoBanco(email, "certa");
      // O token acabou de sair do serviço de contas: a conta e a sessão dele valem. Banco sem a função: segue sem o aviso.
      const sessao = lerToken(d.access_token);
      // P5 (A4): o navegador conhecido (cookie HttpOnly) não recebe o aviso de entrada nova; o novo recebe na hora. Banco ainda sem
      // a função: o aviso de antes (pelo gatilho ou por public.alumia_porta_entrou).
      const reconhecido = sessao ? await reconhecerNavegador(pedido, sessao.conta, sessao.sessao) : null;
      if (sessao && reconhecido?.conhecido === null) await rpcDeServico("alumia_porta_entrou", { p_usuario: sessao.conta, p_sessao: sessao.sessao, p_agente: agente });
      const saida = resposta({ ok: true, sessao: { access_token: d.access_token, refresh_token: d.refresh_token } });
      if (reconhecido?.setCookie) saida.headers.append("Set-Cookie", reconhecido.setCookie);
      return saida;
    }
    const codigo = String(d?.error_code ?? d?.code ?? "");
    if (codigo === "email_not_confirmed") return resposta({ ok: false, motivo: "nao_confirmado" }, 400);
    if (codigo === "invalid_credentials" || r.status === 400) {
      const depois = await contaNoBanco(email, "falhou");
      if (depois?.bloqueado) return resposta({ ok: false, motivo: "bloqueado", minutos: minutos(depois) }, 429);
      return resposta({ ok: false, motivo: "credenciais" }, 400);
    }
    if (r.status === 429) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
    return resposta({ ok: false, motivo: "falha" }, 502);
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
}
