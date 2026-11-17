// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Criar a conta pela porta de entrada (supabase/migracoes/20261114-alumia-o8-porta.sql), a da Alumia e a do site.
//   POST {desafio, resposta, turnstile?, email, senha, codinome, volta, convite?} → {ok, sessao: null} ou {ok: false, motivo}
// Antes de a conta existir, o servidor confere: o desafio da Cloudflare (Turnstile, conferido aqui na Cloudflare quando
// TURNSTILE_SECRET_KEY existe; sem a chave, segue só com a prova própria), a prova de trabalho que o aparelho resolveu, a rede barrada pelo painel, o freio
// da rede nesta hora e o teto da casa por hora (public.alumia_cadastro_passar). Só então cria a conta pela API de ADMINISTRAÇÃO do
// serviço de contas, com a chave de serviço (que só existe aqui), e pede o e-mail de confirmação. Assim o cadastro público do
// serviço de contas pode ficar DESLIGADO : ninguém cria conta sem passar por aqui.
// `convite` é o código do convite da coordenação do site (a função combinada), que o banco confere quando a conta nasce.
// A senha passa por aqui só para chegar ao serviço de contas: não é guardada nem escrita em log. O endereço de rede vira a
// impressão (HMAC) na hora e não é guardado em lugar nenhum. E-mail que já tem conta recebe a mesma resposta (a tela não diz quem
// tem conta).
import { avaliarSenha } from "@/lib/forca-senha";
import { emailBarrado } from "@/lib/rede/admin/servidor";
import { chaveDoFreio, conferirDesafio } from "@/lib/rede/convites/prova-servidor";
import { criarFreio, deOutraOrigem, impressaoDoFreio, impressaoDoPedido, resposta, rpcDeServico, semAFuncao, servico, SUPA } from "@/lib/rede/convites/servidor";
import { EMAIL_VALIDO, servicoDeContas, voltaDaMesmaOrigem } from "@/lib/rede/convites/porta-sem-teto";
import { conferirDesafioDaCloudflare } from "@/lib/rede/convites/turnstile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Para quando o banco ainda não tem a função da porta (a migração da onda 8 não rodou): o freio fica na memória do processo.
const freioDaRede = criarFreio(3, 60 * 60_000);
const freioDaCasa = criarFreio(60, 60 * 60_000);

interface Corpo {
  desafio?: unknown;
  resposta?: unknown;
  turnstile?: unknown;
  email?: unknown;
  senha?: unknown;
  codinome?: unknown;
  volta?: unknown;
  convite?: unknown;
}

export async function POST(pedido: Request) {
  if (deOutraOrigem(pedido)) return resposta({ ok: false, motivo: "origem" }, 403);
  if (!SUPA || !servico()) return resposta({ ok: false, motivo: "sem_servico" }, 503);
  const c = (await pedido.json().catch(() => null)) as Corpo | null;
  const email = typeof c?.email === "string" ? c.email.trim() : "";
  const senha = typeof c?.senha === "string" ? c.senha : "";
  const codinome = typeof c?.codinome === "string" ? c.codinome.trim().slice(0, 40) : "";
  const convite = typeof c?.convite === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(c.convite) ? c.convite : "";
  if (!EMAIL_VALIDO.test(email) || senha.length > 200) return resposta({ ok: false, motivo: "invalido" }, 400);
  // A API de administração não confere a regra de senha do serviço de contas: a regra do site vale aqui (lib/forca-senha.ts).
  if (!avaliarSenha(senha).aceita) return resposta({ ok: false, motivo: "senha_fraca" }, 400);
  // O e-mail de uma conta banida pelo painel de admin não cria conta de novo (só o resumo HMAC, lib/rede/admin/email.ts).
  if (await emailBarrado(email)) return resposta({ ok: false, motivo: "cadastro_fechado" }, 400);
  if ((await conferirDesafioDaCloudflare(c?.turnstile)) === "recusado") return resposta({ ok: false, motivo: "captcha" }, 400);

  const prova = conferirDesafio(c?.desafio, c?.resposta, "conta");
  if (!prova.ok) return resposta({ ok: false, motivo: prova.motivo }, 400);

  const impressao = impressaoDoPedido(pedido);
  const passou = await rpcDeServico<{ ok: boolean; motivo?: string }>("alumia_cadastro_passar", {
    p_momento: "conta", p_chave: chaveDoFreio(impressaoDoFreio(impressao), "conta"), p_selo: prova.selo, p_vence: new Date(prova.vence).toISOString(), p_impressao: impressao,
  });
  if (passou.ok && !passou.dado.ok) return resposta({ ok: false, motivo: passou.dado.motivo ?? "muitos_pedidos" }, 429);
  if (!passou.ok) {
    if (!semAFuncao(passou)) return resposta({ ok: false, motivo: "sem_servico" }, 503);
    if (!freioDaRede(impressao ?? "sem-rede") || !freioDaCasa("casa")) return resposta({ ok: false, motivo: "muitos_pedidos" }, 429);
  }

  const volta = voltaDaMesmaOrigem(pedido, c?.volta);
  const metadados = { ...(codinome ? { apelido: codinome } : {}), ...(convite ? { convite } : {}) };
  try {
    const r = await servicoDeContas("/admin/users", { email, password: senha, email_confirm: false, user_metadata: metadados });
    const d = r.dado;
    const texto = `${String(d?.error_code ?? d?.code ?? "")} ${String(d?.msg ?? d?.message ?? "")}`;
    const jaExiste = r.status === 422 && /email_exists|already|registered/i.test(texto);
    if (!(r.status >= 200 && r.status < 300) && !jaExiste) {
      // A conta não nasceu: senha recusada, o banco recusou (cadastro fechado ou convite que não vale) ou o serviço falhou.
      const motivo = /weak_password/.test(texto) ? "senha_fraca" : r.status === 429 ? "muitos_pedidos" : /database error|convite/i.test(texto) ? "cadastro_fechado" : "falha";
      return resposta({ ok: false, motivo }, r.status === 429 ? 429 : 400);
    }
    // O e-mail de confirmação (também para quem já tinha conta sem confirmar; quem já confirmou não recebe nada). Se não sair agora,
    // a tela de entrar oferece "mandar de novo".
    await servicoDeContas(`/resend${volta ? `?redirect_to=${encodeURIComponent(volta)}` : ""}`, { type: "signup", email }).catch(() => null);
    return resposta({ ok: true, sessao: null });
  } catch {
    return resposta({ ok: false, motivo: "sem_conexao" }, 502);
  }
}
